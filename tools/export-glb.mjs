// Export the model to models/kawasaki-zx6r-2019[-livery].glb (or .usdz for
// iPhone/iPad AR Quick Look) using headless Chromium.
//   node tools/export-glb.mjs [krt|gray] [glb|usdz]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const livery = process.argv[2] || 'krt';
const format = process.argv[3] === 'usdz' ? 'usdz' : 'glb';
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'text/javascript' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.route(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)$/, (route) => {
  const m = route.request().url().match(/three@[^/]+\/(.*)$/);
  route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'node_modules/three', m[1])) });
});
await page.goto(`http://127.0.0.1:${server.address().port}/tools/studio.html?views=none&export=${format}&livery=${livery}&w=64&h=64`);
await page.waitForFunction(() => window.__shots || window.__error, null, { timeout: 300000 });
const err = await page.evaluate(() => window.__error);
if (err) throw new Error(err);
const b64 = await page.evaluate(() => window.__glb);
const bbox = await page.evaluate(() => window.__bbox);
const stats = await page.evaluate(() => window.__stats);
const out = path.join(root, 'models', `kawasaki-zx6r-2019${livery === 'krt' ? '' : '-' + livery}.${format}`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('saved', out, (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
console.log('bbox', JSON.stringify(bbox), 'stats', JSON.stringify(stats));
await browser.close();
server.close();

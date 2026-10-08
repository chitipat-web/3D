// Build a single self-contained HTML file (three.js and all code inlined)
// that opens straight from disk, offline, in any modern browser.
//   node tools/build-standalone.mjs [out]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'offline', 'kawasaki-zx6r-2019.html');
const res = await build({
  entryPoints: [path.join(root, 'src/viewer.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  legalComments: 'none',
  // resolve the bare 'three' / 'three/addons/*' imports from node_modules
  alias: { 'three/addons': path.join(root, 'node_modules/three/examples/jsm') },
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pick = (tag) => {
  const a = html.indexOf(`<!-- artifact:${tag} -->`);
  const b = html.indexOf(`<!-- /artifact:${tag} -->`);
  if (a < 0 || b < 0) throw new Error('missing section ' + tag);
  return html.slice(a + `<!-- artifact:${tag} -->`.length, b).trim();
};
const body = pick('body').replace(/<script type="importmap">[\s\S]*?<\/script>/, '').trim();
// embed the studio HDRI so reflections work without any network
const hdr = fs.readFileSync(path.join(root, 'assets/studio_small_08_1k.hdr')).toString('base64');
const page = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${pick('head')}
</head>
<body>
${body}
<script>window.__ZX6R_HDR = "${hdr}";</script>
<script>
${js}</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log('wrote', out, (page.length / 1024 / 1024).toFixed(2), 'MB');

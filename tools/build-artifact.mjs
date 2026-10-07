// Build a single-file page for publishing: bundles src/viewer.js (three.js
// stays external, loaded from the CDN via the import map) and inlines it
// into the head/body sections of index.html.
//   node tools/build-artifact.mjs [out]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || path.join(root, 'dist', 'zx6r-viewer.html');
const res = await build({
  entryPoints: [path.join(root, 'src/viewer.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  external: ['three', 'three/addons/*'],
  target: 'es2020',
  legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pick = (tag) => {
  const a = html.indexOf(`<!-- artifact:${tag} -->`);
  const b = html.indexOf(`<!-- /artifact:${tag} -->`);
  if (a < 0 || b < 0) throw new Error('missing section ' + tag);
  return html.slice(a + `<!-- artifact:${tag} -->`.length, b).trim();
};
const page = `${pick('head')}\n${pick('body')}\n<script type="module">\n${js}</script>\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log('wrote', out, (page.length / 1024).toFixed(1), 'KB');

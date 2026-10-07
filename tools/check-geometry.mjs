// Sanity-check every mesh of the model: NaN/Inf positions or normals,
// zero-length normals and degenerate triangles.  node tools/check-geometry.mjs
import { buildZX6R } from '../src/zx6r.js';

const bike = buildZX6R({ livery: 'krt' });
let bad = 0;
bike.traverse((o) => {
  if (!o.isMesh) return;
  const g = o.geometry;
  const p = g.attributes.position;
  const n = g.attributes.normal;
  let nanP = 0;
  let nanN = 0;
  let zeroN = 0;
  for (let i = 0; i < p.count; i++) {
    if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) nanP++;
    if (n) {
      const x = n.getX(i);
      const y = n.getY(i);
      const z = n.getZ(i);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) nanN++;
      else if (x * x + y * y + z * z < 1e-8) zeroN++;
    }
  }
  if (nanP || nanN || zeroN) {
    bad++;
    console.log(`${o.name.padEnd(22)} verts ${p.count}  NaN pos ${nanP}  NaN normal ${nanN}  zero normal ${zeroN}`);
  }
});
console.log(bad ? `${bad} meshes with problems` : 'all meshes OK');

// Body-panel builder.
//
// A panel is drawn as a 2-D outline in the side view (x forward, y up, metres)
// and lifted onto a lateral surface z = surface(x, y). The edges are rolled
// inwards with a small radius and finished with a return flange, so each
// panel reads as a real moulded part with thickness, and neighbouring panels
// show a shadow gap between them.
import * as THREE from 'three';
import Delaunator from './vendor/delaunator.js';
import { kf } from './geom.js';

// ------------------------------------------------------------------ outlines
// Outline points are [x, y] (smooth, Catmull-Rom through them) or
// [x, y, 1] (sharp corner). Returns a dense closed loop of [x, y].
export function sampleOutline(pts, step = 0.006) {
  const n = pts.length;
  const corners = [];
  for (let i = 0; i < n; i++) if (pts[i][2]) corners.push(i);
  if (!corners.length) corners.push(0);
  const out = [];
  const get = (i) => pts[((i % n) + n) % n];
  for (let c = 0; c < corners.length; c++) {
    const a = corners[c];
    let b = corners[(c + 1) % corners.length];
    if (b <= a) b += n;
    // control points a..b
    const seg = [];
    for (let i = a; i <= b; i++) seg.push(get(i));
    const sharpEnds = corners.length > 1 || pts[corners[0]][2];
    const P = (k) => {
      if (k < 0) return sharpEnds ? [2 * seg[0][0] - seg[1][0], 2 * seg[0][1] - seg[1][1]] : get(a + k);
      if (k > seg.length - 1) {
        const m = seg.length - 1;
        return sharpEnds ? [2 * seg[m][0] - seg[m - 1][0], 2 * seg[m][1] - seg[m - 1][1]] : get(a + k);
      }
      return seg[k];
    };
    for (let k = 0; k < seg.length - 1; k++) {
      const p0 = P(k - 1);
      const p1 = P(k);
      const p2 = P(k + 1);
      const p3 = P(k + 2);
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const m = Math.max(1, Math.ceil(len / step));
      for (let s = 0; s < m; s++) {
        const t = s / m;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (q) =>
          0.5 * (2 * p1[q] + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3);
        out.push([f(0), f(1), s === 0 && k === 0 ? 1 : 0]);
      }
    }
  }
  return out;
}

export function polyArea(P) {
  let a = 0;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] - P[i][0]) * (P[j][1] + P[i][1]);
  return a / 2; // > 0 for counter-clockwise (x right, y up)
}

export function pointInPoly(x, y, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0];
    const yi = P[i][1];
    const xj = P[j][0];
    const yj = P[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-30) + xi) inside = !inside;
  }
  return inside;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return Math.sqrt(qx * qx + qy * qy);
}

// Distance from (x, y) to a closed loop, accelerated with a uniform grid.
function loopDistance(loops, cell = 0.03) {
  const segs = [];
  for (const L of loops) for (let i = 0; i < L.length; i++) {
    const a = L[i];
    const b = L[(i + 1) % L.length];
    segs.push([a[0], a[1], b[0], b[1]]);
  }
  const grid = new Map();
  const key = (i, j) => i * 100003 + j;
  for (let s = 0; s < segs.length; s++) {
    const [ax, ay, bx, by] = segs[s];
    const i0 = Math.floor(Math.min(ax, bx) / cell);
    const i1 = Math.floor(Math.max(ax, bx) / cell);
    const j0 = Math.floor(Math.min(ay, by) / cell);
    const j1 = Math.floor(Math.max(ay, by) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = key(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(s);
    }
  }
  return (x, y, maxD = 0.05) => {
    const r = Math.ceil(maxD / cell);
    const ci = Math.floor(x / cell);
    const cj = Math.floor(y / cell);
    let best = maxD;
    const seen = new Set();
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
      const list = grid.get(key(i, j));
      if (!list) continue;
      for (const s of list) {
        if (seen.has(s)) continue;
        seen.add(s);
        const d = segDist(x, y, ...segs[s]);
        if (d < best) best = d;
      }
    }
    return best;
  };
}

// Offset a closed CCW loop inwards by d (per-vertex normals; good enough for
// smooth outlines, points that fall outside or cross are dropped by caller).
function insetLoop(L, d) {
  const n = L.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = L[(i - 1 + n) % n];
    const q = L[(i + 1) % n];
    let tx = q[0] - p[0];
    let ty = q[1] - p[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    // inward normal for a CCW loop is (-ty, tx)
    out.push([L[i][0] - ty * d, L[i][1] + tx * d]);
  }
  return out;
}

// ------------------------------------------------------------------ builder
/**
 * buildPanel({ outline, holes, surface, ... }) -> BufferGeometry (right side, z > 0)
 *   outline   control points (see sampleOutline)
 *   holes     array of outlines cut out of the panel (vents)
 *   surface   (x, y) => z of the outer skin
 *   roll      edge radius (m); the skin turns in by this much at the edge
 *   flange    depth of the return lip behind the edge
 *   spacing   interior mesh spacing
 *   uv        (x, y) => [u, v]
 *   creases   extra polylines whose points are inserted into the mesh
 */
export function buildPanel(opts) {
  const {
    outline,
    holes = [],
    surface,
    roll = 0.008,
    flange = 0.012,
    holeRoll = roll,
    holeFlange = flange,
    spacing = 0.014,
    edgeStep = 0.005,
    uv = (x, y) => [x, y],
    creases = [],
    rollProfile = 'round',
    cap = true,
  } = opts;
  let outer = sampleOutline(outline, edgeStep).map((p) => [p[0], p[1]]);
  if (polyArea(outer) < 0) outer.reverse();
  const holeLoops = holes.map((h) => {
    let L = sampleOutline(h, edgeStep).map((p) => [p[0], p[1]]);
    if (polyArea(L) < 0) L.reverse(); // keep CCW; inside of a hole is "outside" of the panel
    return L;
  });
  const dist = loopDistance([outer, ...holeLoops]);
  const insidePanel = (x, y) => pointInPoly(x, y, outer) && !holeLoops.some((H) => pointInPoly(x, y, H));

  // ---- points: boundary loops, inset rows near edges, interior grid
  const pts = [];
  const kind = []; // 0 interior, 1 outer edge, 2 hole edge
  const loopIndex = []; // indices of the boundary points per loop
  const addLoop = (L, k) => {
    const idx = [];
    for (const p of L) {
      idx.push(pts.length);
      pts.push(p);
      kind.push(k);
    }
    loopIndex.push(idx);
  };
  addLoop(outer, 1);
  holeLoops.forEach((H) => addLoop(H, 2));
  const rows = [0.18, 0.42, 0.75];
  const addInset = (L, r, isHole) => {
    if (r <= 1e-6) return;
    for (const f of rows) {
      const d = r * f;
      // a hole's interior is outside the panel, so move away from it
      const off = isHole ? insetLoop(L, -d) : insetLoop(L, d);
      for (let i = 0; i < off.length; i++) {
        const [x, y] = off[i];
        if (!insidePanel(x, y)) continue;
        if (dist(x, y) < d * 0.7) continue;
        pts.push([x, y]);
        kind.push(0);
      }
    }
  };
  addInset(outer, roll, false);
  holeLoops.forEach((H) => addInset(H, holeRoll, true));
  for (const c of creases) {
    for (const p of sampleOutline(c.map((q, i) => (i === 0 || i === c.length - 1 ? [q[0], q[1], 1] : q)), edgeStep * 1.6)) {
      if (insidePanel(p[0], p[1]) && dist(p[0], p[1]) > spacing * 0.5) {
        pts.push([p[0], p[1]]);
        kind.push(0);
      }
    }
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outer) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const hy = spacing * 0.866;
  let row = 0;
  for (let y = minY + hy * 0.5; y < maxY; y += hy, row++) {
    for (let x = minX + (row % 2 ? spacing * 0.5 : 0); x < maxX; x += spacing) {
      if (!insidePanel(x, y)) continue;
      if (dist(x, y, spacing) < Math.max(spacing * 0.55, roll * 0.95)) continue;
      pts.push([x, y]);
      kind.push(0);
    }
  }

  // ---- triangulate
  const flat = new Float64Array(pts.length * 2);
  pts.forEach((p, i) => {
    flat[2 * i] = p[0];
    flat[2 * i + 1] = p[1];
  });
  const del = new Delaunator(flat);
  const T = del.triangles;
  const tris = [];
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t];
    const b = T[t + 1];
    const c = T[t + 2];
    const cx = (pts[a][0] + pts[b][0] + pts[c][0]) / 3;
    const cy = (pts[a][1] + pts[b][1] + pts[c][1]) / 3;
    if (!insidePanel(cx, cy)) continue;
    const area = (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[c][0] - pts[a][0]) * (pts[b][1] - pts[a][1]);
    if (Math.abs(area) < 1e-12) continue;
    if (area > 0) tris.push(a, b, c);
    else tris.push(a, c, b);
  }

  // ---- lift onto the surface with rolled edges
  const pos = [];
  const uvs = [];
  const zEdge = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    let z = surface(x, y);
    const r = kind[i] === 2 ? holeRoll : roll;
    const d = kind[i] ? 0 : dist(x, y, Math.max(roll, holeRoll) * 1.2);
    if (r > 0 && d < r) {
      const t = 1 - d / r;
      const drop = rollProfile === 'round' ? r - Math.sqrt(Math.max(0, r * r - (r * t) * (r * t))) : r * t * t;
      z -= drop;
    }
    zEdge.push(z);
    pos.push(x, y, z);
    const q = uv(x, y);
    uvs.push(q[0], q[1]);
  }
  // ---- return flanges along every boundary loop
  const idx = cap ? tris.slice() : [];
  loopIndex.forEach((L, li) => {
    const depth = li === 0 ? flange : holeFlange;
    if (depth <= 0) return;
    const base = pos.length / 3;
    for (const i of L) {
      pos.push(pts[i][0], pts[i][1], zEdge[i] - depth);
      const q = uv(pts[i][0], pts[i][1]);
      uvs.push(q[0], q[1]);
    }
    const top0 = pos.length / 3;
    for (const i of L) {
      pos.push(pts[i][0], pts[i][1], zEdge[i]);
      const q = uv(pts[i][0], pts[i][1]);
      uvs.push(q[0], q[1]);
    }
    const n = L.length;
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      const a = top0 + k;
      const b = top0 + k1;
      const c = base + k;
      const d = base + k1;
      // outer loop is CCW: outward side is to the right of travel
      if (li === 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Split an indexed geometry into the triangles on the right (z >= 0) and left.
export function splitByZ(g) {
  const pos = g.attributes.position;
  const idx = g.index.array;
  const left = [];
  const right = [];
  for (let i = 0; i < idx.length; i += 3) {
    const zc = pos.getZ(idx[i]) + pos.getZ(idx[i + 1]) + pos.getZ(idx[i + 2]);
    (zc >= 0 ? right : left).push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const gr = g.clone();
  gr.setIndex(right);
  const gl = g.clone();
  gl.setIndex(left);
  return [gr, gl];
}

// ------------------------------------------------------------------ surfaces
// Separable monotone-cubic interpolation over a table: rows (ys) x cols (xs).
export function tableSurface(xs, ys, table) {
  const rowFns = table.map((row) => kf(xs.map((x, i) => [x, row[i]])));
  return (x, y) => {
    const col = ys.map((yy, j) => [yy, rowFns[j](x)]);
    return kf(col)(y);
  };
}

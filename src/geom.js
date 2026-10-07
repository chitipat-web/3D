// Geometry toolkit for the procedural ZX-6R model.
// Units are metres. Bike axes: +X forward, +Y up, +Z to the rider's right.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Keyframed 1-D profiles: kf([[x0, v0], [x1, v1], ...]) returns a smooth,
// overshoot-free function (monotone cubic Hermite, Fritsch-Carlson).
// ---------------------------------------------------------------------------
export function kf(pts) {
  let p = pts.slice();
  if (p.length > 1 && p[0][0] > p[p.length - 1][0]) p = p.reverse();
  const n = p.length;
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  if (n === 1) return () => ys[0];
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]) * 0; // clamp
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Catmull-Rom helpers on [x, y, z] arrays
// ---------------------------------------------------------------------------
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const o = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    o[k] =
      0.5 *
      (2 * p1[k] +
        (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  }
  return o;
}
const refl = (a, b) => [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]];

// Densify control points a..b (inclusive) with `res` samples per segment.
function densify(pts, a, b, res, closed = false) {
  const n = pts.length;
  const out = [];
  if (closed) {
    const g = (i) => pts[((i % n) + n) % n];
    for (let i = 0; i < n; i++) {
      for (let s = 0; s < res; s++) out.push(cr(g(i - 1), g(i), g(i + 1), g(i + 2), s / res));
    }
    return out; // no duplicated seam point
  }
  const get = (i) => {
    if (i < a) return refl(pts[a], pts[a + 1]);
    if (i > b) return refl(pts[b], pts[b - 1]);
    return pts[i];
  };
  for (let i = a; i < b; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    for (let s = 0; s < res; s++) out.push(cr(p0, p1, p2, p3, s / res));
  }
  out.push(pts[b].slice());
  return out;
}

function spans(count, creases) {
  const cs = [...new Set(creases)].filter((c) => c > 0 && c < count - 1).sort((a, b) => a - b);
  const out = [];
  let s = 0;
  for (const c of cs) {
    out.push([s, c]);
    s = c;
  }
  out.push([s, count - 1]);
  return out;
}

const toArr = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);

// ---------------------------------------------------------------------------
// loft(rings): bicubic Catmull-Rom surface through a grid of control points.
//   rings[k][m] = [x, y, z]  (K rows x M columns)
//   creaseCols / creaseRows: indices where the surface has a hard edge.
//   mat(rowSpan, colSpan) -> material index (geometry groups).
//   uv(p) -> [u, v] optional projection; default is the grid parameter.
// ---------------------------------------------------------------------------
export function loft(rings, opts = {}) {
  const {
    creaseCols = [],
    creaseRows = [],
    su = 6,
    sv = 6,
    closed = false,
    flip = false,
    mat = null,
    uv = null,
  } = opts;
  const R = rings.map((r) => r.map(toArr));
  const K = R.length;
  const M = R[0].length;
  const colSpans = closed ? [[0, M]] : spans(M, creaseCols);
  const rowSpans = spans(K, creaseRows);
  const parts = [];
  const groups = [];
  colSpans.forEach(([ca, cb], ci) => {
    const dense = R.map((ring) => densify(ring, ca, cb, su, closed));
    const Md = dense[0].length;
    rowSpans.forEach(([ra, rb], ri) => {
      const cols = [];
      for (let j = 0; j < Md; j++) cols.push(densify(dense.map((d) => d[j]), ra, rb, sv));
      const Kd = cols[0].length;
      const pos = [];
      const uvs = [];
      for (let i = 0; i < Kd; i++) {
        for (let j = 0; j < Md; j++) {
          const p = cols[j][i];
          pos.push(p[0], p[1], p[2]);
          if (uv) {
            const q = uv(p, ri, ci);
            uvs.push(q[0], q[1]);
          } else {
            const u = closed ? j / Md : (ca + j / su) / (M - 1);
            const v = (ra + i / sv) / (K - 1);
            uvs.push(u, v);
          }
        }
      }
      const idx = [];
      const cw = closed ? Md : Md - 1;
      for (let i = 0; i < Kd - 1; i++) {
        for (let j = 0; j < cw; j++) {
          const j1 = (j + 1) % Md;
          const a = i * Md + j;
          const b = (i + 1) * Md + j;
          const c = i * Md + j1;
          const d = (i + 1) * Md + j1;
          if (flip) idx.push(a, c, b, c, d, b);
          else idx.push(a, b, c, c, b, d);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      parts.push(g);
      groups.push(mat ? mat(ri, ci) : 0);
    });
  });
  return combine(parts, groups);
}

// Merge geometries, keeping a material group per entry in `groups`.
export function combine(parts, groups) {
  const order = parts.map((g, i) => i).sort((a, b) => groups[a] - groups[b]);
  const sorted = order.map((i) => parts[i]);
  const merged = mergeGeometries(sorted, false);
  merged.clearGroups();
  let start = 0;
  let cur = null;
  let curStart = 0;
  order.forEach((i, k) => {
    const g = sorted[k];
    const count = g.index ? g.index.count : g.attributes.position.count;
    if (cur === null) {
      cur = groups[i];
      curStart = start;
    } else if (groups[i] !== cur) {
      merged.addGroup(curStart, start - curStart, cur);
      cur = groups[i];
      curStart = start;
    }
    start += count;
  });
  merged.addGroup(curStart, start - curStart, cur);
  return merged;
}

// Mirror a geometry across the XY plane (z -> -z) keeping outward winding.
export function mirrorZ(geom) {
  const g = geom.clone();
  g.scale(1, 1, -1);
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    g.index.needsUpdate = true;
  } else {
    const p = g.attributes.position;
    const swap = (attr) => {
      if (!attr) return;
      const s = attr.itemSize;
      const arr = attr.array;
      for (let i = 0; i < attr.count; i += 3) {
        for (let k = 0; k < s; k++) {
          const t = arr[(i + 1) * s + k];
          arr[(i + 1) * s + k] = arr[(i + 2) * s + k];
          arr[(i + 2) * s + k] = t;
        }
      }
    };
    swap(p);
    swap(g.attributes.normal);
    swap(g.attributes.uv);
  }
  return g;
}

// Mirror helper for symmetric half-rings. half = [[x,y,z], ...] ordered from
// the centre line (z = 0) outward. Returns a full ring left -> right.
export function mirrorRing(half, { centerCrease = false } = {}) {
  const right = half.map(toArr);
  const left = right
    .slice(1)
    .reverse()
    .map((p) => [p[0], p[1], -p[2]]);
  return left.concat(right);
}

// Map crease indices of a half-ring (0 = centre) onto the mirrored full ring.
export function mirrorCreases(halfCreases, halfLen, centerCrease = false) {
  const c = halfLen - 1;
  const out = [];
  for (const h of halfCreases) {
    if (h === 0) continue;
    out.push(c + h, c - h);
  }
  if (centerCrease) out.push(c);
  return out;
}

// ---------------------------------------------------------------------------
// Lathe around the Z axis. prof = [[r, z], ...] traced so that the surface
// normal (dz, -dr) points outward.
// ---------------------------------------------------------------------------
export function latheZ(prof, segments = 64, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = prof.map(([r, z]) => new THREE.Vector2(Math.max(r, 1e-5), z));
  const g = new THREE.LatheGeometry(pts, segments, phiStart, phiLength);
  g.rotateX(Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------------------
// Sweep a 2-D profile along a 3-D path with rotation-minimising frames.
//   path: array of THREE.Vector3 (or a THREE.Curve, sampled with `steps`)
//   profile(t) -> [[a, b], ...] closed loop in the local (N, B) plane
//   up: preferred direction for the profile's +a axis at the start
// ---------------------------------------------------------------------------
export function sweep(path, profile, opts = {}) {
  const { steps = 48, up = new THREE.Vector3(0, 1, 0), caps = true, smoothProfile = true } = opts;
  let P;
  if (Array.isArray(path)) {
    if (path.length > 2 && opts.spline !== false) {
      const curve = new THREE.CatmullRomCurve3(path.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), false, 'centripetal');
      P = curve.getSpacedPoints(steps);
    } else P = path.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
  } else P = path.getSpacedPoints(steps);
  const n = P.length;
  const T = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(n - 1, i + 1)];
    T.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  const N = [];
  const B = [];
  let nn = up.clone().sub(T[0].clone().multiplyScalar(up.dot(T[0])));
  if (nn.lengthSq() < 1e-8) nn = new THREE.Vector3(1, 0, 0).sub(T[0].clone().multiplyScalar(T[0].x));
  nn.normalize();
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      // double reflection method (Wang et al.)
      const v1 = new THREE.Vector3().subVectors(P[i], P[i - 1]);
      const c1 = v1.dot(v1);
      if (c1 > 1e-12) {
        const rL = nn.clone().sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(nn)));
        const tL = T[i - 1].clone().sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(T[i - 1])));
        const v2 = new THREE.Vector3().subVectors(T[i], tL);
        const c2 = v2.dot(v2);
        nn = c2 > 1e-12 ? rL.sub(v2.clone().multiplyScalar((2 / c2) * v2.dot(rL))) : rL;
      }
      nn.normalize();
    }
    N.push(nn.clone());
    B.push(new THREE.Vector3().crossVectors(T[i], nn).normalize());
  }
  const rings = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const pr = profile(t);
    rings.push(
      pr.map(([a, b]) => {
        const v = P[i].clone().addScaledVector(N[i], a).addScaledVector(B[i], b);
        return [v.x, v.y, v.z];
      })
    );
  }
  let g = loft(rings, { closed: true, su: 1, sv: 1 });
  // make sure the skin faces away from the path
  {
    const nrm = g.attributes.normal;
    const pos = g.attributes.position;
    const mid = Math.floor(n / 2) * rings[0].length;
    const out = new THREE.Vector3(pos.getX(mid), pos.getY(mid), pos.getZ(mid)).sub(P[Math.floor(n / 2)]);
    const nv = new THREE.Vector3(nrm.getX(mid), nrm.getY(mid), nrm.getZ(mid));
    if (out.dot(nv) < 0) g = flipGeometry(g);
  }
  if (!caps) return g;
  const capFor = (ring, center, dir) => {
    const pos = [center[0], center[1], center[2]];
    ring.forEach((p) => pos.push(p[0], p[1], p[2]));
    const idx = [];
    for (let k = 0; k < ring.length; k++) idx.push(0, 1 + k, 1 + ((k + 1) % ring.length));
    let cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((ring.length + 1) * 2).fill(0), 2));
    cg.setIndex(idx);
    cg.computeVertexNormals();
    const nz = new THREE.Vector3(cg.attributes.normal.getX(0), cg.attributes.normal.getY(0), cg.attributes.normal.getZ(0));
    if (nz.dot(dir) < 0) cg = flipGeometry(cg);
    return cg;
  };
  const avg = (ring) => ring.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / ring.length);
  return mergeGeometries(
    [g, capFor(rings[0], avg(rings[0]), T[0].clone().negate()), capFor(rings[n - 1], avg(rings[n - 1]), T[n - 1])],
    false
  );
}

// Reverse triangle winding and normals.
export function flipGeometry(geom) {
  const g = geom;
  if (g.index) {
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    g.index.needsUpdate = true;
  }
  const nr = g.attributes.normal;
  if (nr) {
    for (let i = 0; i < nr.array.length; i++) nr.array[i] = -nr.array[i];
    nr.needsUpdate = true;
  }
  return g;
}

// Rounded-rectangle profile (for sweep), w x h with corner radius r.
export function rrect(w, h, r, seg = 3) {
  const out = [];
  const hw = w / 2;
  const hh = h / 2;
  r = Math.min(r, hw * 0.99, hh * 0.99);
  const corners = [
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, Math.PI / 2],
    [-hw + r, -hh + r, Math.PI],
    [hw - r, -hh + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (k / seg) * (Math.PI / 2);
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return out;
}

export function circle(r, seg = 16) {
  const out = [];
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2;
    out.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return out;
}

// Polygon (array of [x, y]) -> THREE.Shape, optionally with holes.
export function shape(pts, holes = []) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}

export function circlePts(cx, cy, r, seg = 24, reverse = false) {
  const out = [];
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2 * (reverse ? -1 : 1);
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// Extrude a 2-D shape (in XY) along +Z by depth, centred on z = 0.
export function extrude(shp, depth, bevel = 0, bevelSegments = 2, curveSegments = 12) {
  const g = new THREE.ExtrudeGeometry(shp, {
    depth: Math.max(1e-4, depth - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
  });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
}

export function rbox(w, h, d, r = 0.004, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
}

export function cyl(r1, r2, h, seg = 24, open = false) {
  return new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);
}

// Cylinder between two points.
export function rod(a, b, r, seg = 12, r2 = r) {
  const A = a.isVector3 ? a : new THREE.Vector3(...a);
  const B = b.isVector3 ? b : new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, false);
  const dir = new THREE.Vector3().subVectors(B, A).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

// Tube along points (circular), wrapping THREE.TubeGeometry.
export function tube(points, r, seg = 64, radial = 12, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, r, radial, closed);
}

// Apply translation/rotation (Euler, radians) and scale to a geometry in place.
export function place(g, { p = [0, 0, 0], r = [0, 0, 0], s = null, order = 'XYZ' } = {}) {
  if (s) g.scale(...(Array.isArray(s) ? s : [s, s, s]));
  const e = new THREE.Euler(r[0], r[1], r[2], order);
  g.applyQuaternion(new THREE.Quaternion().setFromEuler(e));
  g.translate(p[0], p[1], p[2]);
  return g;
}

export function merge(list) {
  const flat = list.filter(Boolean).map((g) => {
    let x = g;
    if (!x.index) x = mergeVertices(x, 1e-7);
    if (!x.attributes.uv) {
      x.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(x.attributes.position.count * 2).fill(0), 2));
    }
    if (!x.attributes.normal) x.computeVertexNormals();
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
    x.clearGroups();
    return x;
  });
  return mergeGeometries(flat, false);
}

// Planar UV projection helpers (metres -> texture space).
export const uvSide = (x0, x1, y0, y1) => (p) => [(p[0] - x0) / (x1 - x0), (p[1] - y0) / (y1 - y0)];
export const uvTop = (x0, x1, z0, z1) => (p) => [(p[0] - x0) / (x1 - x0), (p[2] - z0) / (z1 - z0)];
export const uvFront = (z0, z1, y0, y1) => (p) => [(p[2] - z0) / (z1 - z0), (p[1] - y0) / (y1 - y0)];

export { mergeGeometries, mergeVertices };

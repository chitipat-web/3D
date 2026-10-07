/*
 * Delaunator v5.0.1 (https://github.com/mapbox/delaunator)
 * ISC License, Copyright (c) 2021, Mapbox.
 * Includes robust-predicates v3.0.2 (https://github.com/mourner/robust-predicates), public domain (Unlicense).
 * Bundled into a single ES module for this project.
 */
// node_modules/robust-predicates/esm/util.js
var epsilon = 11102230246251565e-32, splitter = 134217729, resulterrbound = (3 + 8 * epsilon) * epsilon;
function sum(elen, e, flen, f, h) {
  let Q, Qnew, hh, bvirt, enow = e[0], fnow = f[0], eindex = 0, findex = 0;
  fnow > enow == fnow > -enow ? (Q = enow, enow = e[++eindex]) : (Q = fnow, fnow = f[++findex]);
  let hindex = 0;
  if (eindex < elen && findex < flen)
    for (fnow > enow == fnow > -enow ? (Qnew = enow + Q, hh = Q - (Qnew - enow), enow = e[++eindex]) : (Qnew = fnow + Q, hh = Q - (Qnew - fnow), fnow = f[++findex]), Q = Qnew, hh !== 0 && (h[hindex++] = hh); eindex < elen && findex < flen; )
      fnow > enow == fnow > -enow ? (Qnew = Q + enow, bvirt = Qnew - Q, hh = Q - (Qnew - bvirt) + (enow - bvirt), enow = e[++eindex]) : (Qnew = Q + fnow, bvirt = Qnew - Q, hh = Q - (Qnew - bvirt) + (fnow - bvirt), fnow = f[++findex]), Q = Qnew, hh !== 0 && (h[hindex++] = hh);
  for (; eindex < elen; )
    Qnew = Q + enow, bvirt = Qnew - Q, hh = Q - (Qnew - bvirt) + (enow - bvirt), enow = e[++eindex], Q = Qnew, hh !== 0 && (h[hindex++] = hh);
  for (; findex < flen; )
    Qnew = Q + fnow, bvirt = Qnew - Q, hh = Q - (Qnew - bvirt) + (fnow - bvirt), fnow = f[++findex], Q = Qnew, hh !== 0 && (h[hindex++] = hh);
  return (Q !== 0 || hindex === 0) && (h[hindex++] = Q), hindex;
}
function estimate(elen, e) {
  let Q = e[0];
  for (let i = 1; i < elen; i++) Q += e[i];
  return Q;
}
function vec(n) {
  return new Float64Array(n);
}

// node_modules/robust-predicates/esm/orient2d.js
var ccwerrboundA = (3 + 16 * epsilon) * epsilon, ccwerrboundB = (2 + 12 * epsilon) * epsilon, ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon, B = vec(4), C1 = vec(8), C2 = vec(12), D = vec(16), u = vec(4);
function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
  let acxtail, acytail, bcxtail, bcytail, bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u32, acx = ax - cx, bcx = bx - cx, acy = ay - cy, bcy = by - cy;
  s1 = acx * bcy, c = splitter * acx, ahi = c - (c - acx), alo = acx - ahi, c = splitter * bcy, bhi = c - (c - bcy), blo = bcy - bhi, s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo), t1 = acy * bcx, c = splitter * acy, ahi = c - (c - acy), alo = acy - ahi, c = splitter * bcx, bhi = c - (c - bcx), blo = bcx - bhi, t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo), _i = s0 - t0, bvirt = s0 - _i, B[0] = s0 - (_i + bvirt) + (bvirt - t0), _j = s1 + _i, bvirt = _j - s1, _0 = s1 - (_j - bvirt) + (_i - bvirt), _i = _0 - t1, bvirt = _0 - _i, B[1] = _0 - (_i + bvirt) + (bvirt - t1), u32 = _j + _i, bvirt = u32 - _j, B[2] = _j - (u32 - bvirt) + (_i - bvirt), B[3] = u32;
  let det = estimate(4, B), errbound = ccwerrboundB * detsum;
  if (det >= errbound || -det >= errbound || (bvirt = ax - acx, acxtail = ax - (acx + bvirt) + (bvirt - cx), bvirt = bx - bcx, bcxtail = bx - (bcx + bvirt) + (bvirt - cx), bvirt = ay - acy, acytail = ay - (acy + bvirt) + (bvirt - cy), bvirt = by - bcy, bcytail = by - (bcy + bvirt) + (bvirt - cy), acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) || (errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det), det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail), det >= errbound || -det >= errbound)) return det;
  s1 = acxtail * bcy, c = splitter * acxtail, ahi = c - (c - acxtail), alo = acxtail - ahi, c = splitter * bcy, bhi = c - (c - bcy), blo = bcy - bhi, s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo), t1 = acytail * bcx, c = splitter * acytail, ahi = c - (c - acytail), alo = acytail - ahi, c = splitter * bcx, bhi = c - (c - bcx), blo = bcx - bhi, t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo), _i = s0 - t0, bvirt = s0 - _i, u[0] = s0 - (_i + bvirt) + (bvirt - t0), _j = s1 + _i, bvirt = _j - s1, _0 = s1 - (_j - bvirt) + (_i - bvirt), _i = _0 - t1, bvirt = _0 - _i, u[1] = _0 - (_i + bvirt) + (bvirt - t1), u32 = _j + _i, bvirt = u32 - _j, u[2] = _j - (u32 - bvirt) + (_i - bvirt), u[3] = u32;
  let C1len = sum(4, B, 4, u, C1);
  s1 = acx * bcytail, c = splitter * acx, ahi = c - (c - acx), alo = acx - ahi, c = splitter * bcytail, bhi = c - (c - bcytail), blo = bcytail - bhi, s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo), t1 = acy * bcxtail, c = splitter * acy, ahi = c - (c - acy), alo = acy - ahi, c = splitter * bcxtail, bhi = c - (c - bcxtail), blo = bcxtail - bhi, t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo), _i = s0 - t0, bvirt = s0 - _i, u[0] = s0 - (_i + bvirt) + (bvirt - t0), _j = s1 + _i, bvirt = _j - s1, _0 = s1 - (_j - bvirt) + (_i - bvirt), _i = _0 - t1, bvirt = _0 - _i, u[1] = _0 - (_i + bvirt) + (bvirt - t1), u32 = _j + _i, bvirt = u32 - _j, u[2] = _j - (u32 - bvirt) + (_i - bvirt), u[3] = u32;
  let C2len = sum(C1len, C1, 4, u, C2);
  s1 = acxtail * bcytail, c = splitter * acxtail, ahi = c - (c - acxtail), alo = acxtail - ahi, c = splitter * bcytail, bhi = c - (c - bcytail), blo = bcytail - bhi, s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo), t1 = acytail * bcxtail, c = splitter * acytail, ahi = c - (c - acytail), alo = acytail - ahi, c = splitter * bcxtail, bhi = c - (c - bcxtail), blo = bcxtail - bhi, t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo), _i = s0 - t0, bvirt = s0 - _i, u[0] = s0 - (_i + bvirt) + (bvirt - t0), _j = s1 + _i, bvirt = _j - s1, _0 = s1 - (_j - bvirt) + (_i - bvirt), _i = _0 - t1, bvirt = _0 - _i, u[1] = _0 - (_i + bvirt) + (bvirt - t1), u32 = _j + _i, bvirt = u32 - _j, u[2] = _j - (u32 - bvirt) + (_i - bvirt), u[3] = u32;
  let Dlen = sum(C2len, C2, 4, u, D);
  return D[Dlen - 1];
}
function orient2d(ax, ay, bx, by, cx, cy) {
  let detleft = (ay - cy) * (bx - cx), detright = (ax - cx) * (by - cy), det = detleft - detright, detsum = Math.abs(detleft + detright);
  return Math.abs(det) >= ccwerrboundA * detsum ? det : -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
}

// node_modules/robust-predicates/esm/orient3d.js
var o3derrboundA = (7 + 56 * epsilon) * epsilon, o3derrboundB = (3 + 28 * epsilon) * epsilon, o3derrboundC = (26 + 288 * epsilon) * epsilon * epsilon, bc = vec(4), ca = vec(4), ab = vec(4), at_b = vec(4), at_c = vec(4), bt_c = vec(4), bt_a = vec(4), ct_a = vec(4), ct_b = vec(4), bct = vec(8), cat = vec(8), abt = vec(8), u2 = vec(4), _8 = vec(8), _8b = vec(8), _16 = vec(16), _12 = vec(12), fin = vec(192), fin2 = vec(192);

// node_modules/robust-predicates/esm/incircle.js
var iccerrboundA = (10 + 96 * epsilon) * epsilon, iccerrboundB = (4 + 48 * epsilon) * epsilon, iccerrboundC = (44 + 576 * epsilon) * epsilon * epsilon, bc2 = vec(4), ca2 = vec(4), ab2 = vec(4), aa = vec(4), bb = vec(4), cc = vec(4), u3 = vec(4), v = vec(4), axtbc = vec(8), aytbc = vec(8), bxtca = vec(8), bytca = vec(8), cxtab = vec(8), cytab = vec(8), abt2 = vec(8), bct2 = vec(8), cat2 = vec(8), abtt = vec(4), bctt = vec(4), catt = vec(4), _82 = vec(8), _162 = vec(16), _16b = vec(16), _16c = vec(16), _32 = vec(32), _32b = vec(32), _48 = vec(48), _64 = vec(64), fin3 = vec(1152), fin22 = vec(1152);

// node_modules/robust-predicates/esm/insphere.js
var isperrboundA = (16 + 224 * epsilon) * epsilon, isperrboundB = (5 + 72 * epsilon) * epsilon, isperrboundC = (71 + 1408 * epsilon) * epsilon * epsilon, ab3 = vec(4), bc3 = vec(4), cd = vec(4), de = vec(4), ea = vec(4), ac = vec(4), bd = vec(4), ce = vec(4), da = vec(4), eb = vec(4), abc = vec(24), bcd = vec(24), cde = vec(24), dea = vec(24), eab = vec(24), abd = vec(24), bce = vec(24), cda = vec(24), deb = vec(24), eac = vec(24), adet = vec(1152), bdet = vec(1152), cdet = vec(1152), ddet = vec(1152), edet = vec(1152), abdet = vec(2304), cddet = vec(2304), cdedet = vec(3456), deter = vec(5760), _83 = vec(8), _8b2 = vec(8), _8c = vec(8), _163 = vec(16), _24 = vec(24), _482 = vec(48), _48b = vec(48), _96 = vec(96), _192 = vec(192), _384x = vec(384), _384y = vec(384), _384z = vec(384), _768 = vec(768);
var xdet = vec(96), ydet = vec(96), zdet = vec(96), fin4 = vec(1152);

// node_modules/delaunator/index.js
var EPSILON = Math.pow(2, -52), EDGE_STACK = new Uint32Array(512), Delaunator = class _Delaunator {
  static from(points, getX = defaultGetX, getY = defaultGetY) {
    let n = points.length, coords = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      let p = points[i];
      coords[2 * i] = getX(p), coords[2 * i + 1] = getY(p);
    }
    return new _Delaunator(coords);
  }
  constructor(coords) {
    let n = coords.length >> 1;
    if (n > 0 && typeof coords[0] != "number") throw new Error("Expected coords to contain numbers.");
    this.coords = coords;
    let maxTriangles = Math.max(2 * n - 5, 0);
    this._triangles = new Uint32Array(maxTriangles * 3), this._halfedges = new Int32Array(maxTriangles * 3), this._hashSize = Math.ceil(Math.sqrt(n)), this._hullPrev = new Uint32Array(n), this._hullNext = new Uint32Array(n), this._hullTri = new Uint32Array(n), this._hullHash = new Int32Array(this._hashSize), this._ids = new Uint32Array(n), this._dists = new Float64Array(n), this.update();
  }
  update() {
    let { coords, _hullPrev: hullPrev, _hullNext: hullNext, _hullTri: hullTri, _hullHash: hullHash } = this, n = coords.length >> 1, minX = 1 / 0, minY = 1 / 0, maxX = -1 / 0, maxY = -1 / 0;
    for (let i = 0; i < n; i++) {
      let x = coords[2 * i], y = coords[2 * i + 1];
      x < minX && (minX = x), y < minY && (minY = y), x > maxX && (maxX = x), y > maxY && (maxY = y), this._ids[i] = i;
    }
    let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, i0, i1, i2;
    for (let i = 0, minDist = 1 / 0; i < n; i++) {
      let d = dist(cx, cy, coords[2 * i], coords[2 * i + 1]);
      d < minDist && (i0 = i, minDist = d);
    }
    let i0x = coords[2 * i0], i0y = coords[2 * i0 + 1];
    for (let i = 0, minDist = 1 / 0; i < n; i++) {
      if (i === i0) continue;
      let d = dist(i0x, i0y, coords[2 * i], coords[2 * i + 1]);
      d < minDist && d > 0 && (i1 = i, minDist = d);
    }
    let i1x = coords[2 * i1], i1y = coords[2 * i1 + 1], minRadius = 1 / 0;
    for (let i = 0; i < n; i++) {
      if (i === i0 || i === i1) continue;
      let r = circumradius(i0x, i0y, i1x, i1y, coords[2 * i], coords[2 * i + 1]);
      r < minRadius && (i2 = i, minRadius = r);
    }
    let i2x = coords[2 * i2], i2y = coords[2 * i2 + 1];
    if (minRadius === 1 / 0) {
      for (let i = 0; i < n; i++)
        this._dists[i] = coords[2 * i] - coords[0] || coords[2 * i + 1] - coords[1];
      quicksort(this._ids, this._dists, 0, n - 1);
      let hull = new Uint32Array(n), j = 0;
      for (let i = 0, d0 = -1 / 0; i < n; i++) {
        let id = this._ids[i], d = this._dists[id];
        d > d0 && (hull[j++] = id, d0 = d);
      }
      this.hull = hull.subarray(0, j), this.triangles = new Uint32Array(0), this.halfedges = new Uint32Array(0);
      return;
    }
    if (orient2d(i0x, i0y, i1x, i1y, i2x, i2y) < 0) {
      let i = i1, x = i1x, y = i1y;
      i1 = i2, i1x = i2x, i1y = i2y, i2 = i, i2x = x, i2y = y;
    }
    let center = circumcenter(i0x, i0y, i1x, i1y, i2x, i2y);
    this._cx = center.x, this._cy = center.y;
    for (let i = 0; i < n; i++)
      this._dists[i] = dist(coords[2 * i], coords[2 * i + 1], center.x, center.y);
    quicksort(this._ids, this._dists, 0, n - 1), this._hullStart = i0;
    let hullSize = 3;
    hullNext[i0] = hullPrev[i2] = i1, hullNext[i1] = hullPrev[i0] = i2, hullNext[i2] = hullPrev[i1] = i0, hullTri[i0] = 0, hullTri[i1] = 1, hullTri[i2] = 2, hullHash.fill(-1), hullHash[this._hashKey(i0x, i0y)] = i0, hullHash[this._hashKey(i1x, i1y)] = i1, hullHash[this._hashKey(i2x, i2y)] = i2, this.trianglesLen = 0, this._addTriangle(i0, i1, i2, -1, -1, -1);
    for (let k = 0, xp, yp; k < this._ids.length; k++) {
      let i = this._ids[k], x = coords[2 * i], y = coords[2 * i + 1];
      if (k > 0 && Math.abs(x - xp) <= EPSILON && Math.abs(y - yp) <= EPSILON || (xp = x, yp = y, i === i0 || i === i1 || i === i2)) continue;
      let start = 0;
      for (let j = 0, key = this._hashKey(x, y); j < this._hashSize && (start = hullHash[(key + j) % this._hashSize], !(start !== -1 && start !== hullNext[start])); j++)
        ;
      start = hullPrev[start];
      let e = start, q;
      for (; q = hullNext[e], orient2d(x, y, coords[2 * e], coords[2 * e + 1], coords[2 * q], coords[2 * q + 1]) >= 0; )
        if (e = q, e === start) {
          e = -1;
          break;
        }
      if (e === -1) continue;
      let t = this._addTriangle(e, i, hullNext[e], -1, -1, hullTri[e]);
      hullTri[i] = this._legalize(t + 2), hullTri[e] = t, hullSize++;
      let n2 = hullNext[e];
      for (; q = hullNext[n2], orient2d(x, y, coords[2 * n2], coords[2 * n2 + 1], coords[2 * q], coords[2 * q + 1]) < 0; )
        t = this._addTriangle(n2, i, q, hullTri[i], -1, hullTri[n2]), hullTri[i] = this._legalize(t + 2), hullNext[n2] = n2, hullSize--, n2 = q;
      if (e === start)
        for (; q = hullPrev[e], orient2d(x, y, coords[2 * q], coords[2 * q + 1], coords[2 * e], coords[2 * e + 1]) < 0; )
          t = this._addTriangle(q, i, e, -1, hullTri[e], hullTri[q]), this._legalize(t + 2), hullTri[q] = t, hullNext[e] = e, hullSize--, e = q;
      this._hullStart = hullPrev[i] = e, hullNext[e] = hullPrev[n2] = i, hullNext[i] = n2, hullHash[this._hashKey(x, y)] = i, hullHash[this._hashKey(coords[2 * e], coords[2 * e + 1])] = e;
    }
    this.hull = new Uint32Array(hullSize);
    for (let i = 0, e = this._hullStart; i < hullSize; i++)
      this.hull[i] = e, e = hullNext[e];
    this.triangles = this._triangles.subarray(0, this.trianglesLen), this.halfedges = this._halfedges.subarray(0, this.trianglesLen);
  }
  _hashKey(x, y) {
    return Math.floor(pseudoAngle(x - this._cx, y - this._cy) * this._hashSize) % this._hashSize;
  }
  _legalize(a) {
    let { _triangles: triangles, _halfedges: halfedges, coords } = this, i = 0, ar = 0;
    for (; ; ) {
      let b = halfedges[a], a0 = a - a % 3;
      if (ar = a0 + (a + 2) % 3, b === -1) {
        if (i === 0) break;
        a = EDGE_STACK[--i];
        continue;
      }
      let b0 = b - b % 3, al = a0 + (a + 1) % 3, bl = b0 + (b + 2) % 3, p0 = triangles[ar], pr = triangles[a], pl = triangles[al], p1 = triangles[bl];
      if (inCircle(
        coords[2 * p0],
        coords[2 * p0 + 1],
        coords[2 * pr],
        coords[2 * pr + 1],
        coords[2 * pl],
        coords[2 * pl + 1],
        coords[2 * p1],
        coords[2 * p1 + 1]
      )) {
        triangles[a] = p1, triangles[b] = p0;
        let hbl = halfedges[bl];
        if (hbl === -1) {
          let e = this._hullStart;
          do {
            if (this._hullTri[e] === bl) {
              this._hullTri[e] = a;
              break;
            }
            e = this._hullPrev[e];
          } while (e !== this._hullStart);
        }
        this._link(a, hbl), this._link(b, halfedges[ar]), this._link(ar, bl);
        let br = b0 + (b + 1) % 3;
        i < EDGE_STACK.length && (EDGE_STACK[i++] = br);
      } else {
        if (i === 0) break;
        a = EDGE_STACK[--i];
      }
    }
    return ar;
  }
  _link(a, b) {
    this._halfedges[a] = b, b !== -1 && (this._halfedges[b] = a);
  }
  // add a new triangle given vertex indices and adjacent half-edge ids
  _addTriangle(i0, i1, i2, a, b, c) {
    let t = this.trianglesLen;
    return this._triangles[t] = i0, this._triangles[t + 1] = i1, this._triangles[t + 2] = i2, this._link(t, a), this._link(t + 1, b), this._link(t + 2, c), this.trianglesLen += 3, t;
  }
};
function pseudoAngle(dx, dy) {
  let p = dx / (Math.abs(dx) + Math.abs(dy));
  return (dy > 0 ? 3 - p : 1 + p) / 4;
}
function dist(ax, ay, bx, by) {
  let dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
function inCircle(ax, ay, bx, by, cx, cy, px, py) {
  let dx = ax - px, dy = ay - py, ex = bx - px, ey = by - py, fx = cx - px, fy = cy - py, ap = dx * dx + dy * dy, bp = ex * ex + ey * ey, cp = fx * fx + fy * fy;
  return dx * (ey * cp - bp * fy) - dy * (ex * cp - bp * fx) + ap * (ex * fy - ey * fx) < 0;
}
function circumradius(ax, ay, bx, by, cx, cy) {
  let dx = bx - ax, dy = by - ay, ex = cx - ax, ey = cy - ay, bl = dx * dx + dy * dy, cl = ex * ex + ey * ey, d = 0.5 / (dx * ey - dy * ex), x = (ey * bl - dy * cl) * d, y = (dx * cl - ex * bl) * d;
  return x * x + y * y;
}
function circumcenter(ax, ay, bx, by, cx, cy) {
  let dx = bx - ax, dy = by - ay, ex = cx - ax, ey = cy - ay, bl = dx * dx + dy * dy, cl = ex * ex + ey * ey, d = 0.5 / (dx * ey - dy * ex), x = ax + (ey * bl - dy * cl) * d, y = ay + (dx * cl - ex * bl) * d;
  return { x, y };
}
function quicksort(ids, dists, left, right) {
  if (right - left <= 20)
    for (let i = left + 1; i <= right; i++) {
      let temp = ids[i], tempDist = dists[temp], j = i - 1;
      for (; j >= left && dists[ids[j]] > tempDist; ) ids[j + 1] = ids[j--];
      ids[j + 1] = temp;
    }
  else {
    let median = left + right >> 1, i = left + 1, j = right;
    swap(ids, median, i), dists[ids[left]] > dists[ids[right]] && swap(ids, left, right), dists[ids[i]] > dists[ids[right]] && swap(ids, i, right), dists[ids[left]] > dists[ids[i]] && swap(ids, left, i);
    let temp = ids[i], tempDist = dists[temp];
    for (; ; ) {
      do
        i++;
      while (dists[ids[i]] < tempDist);
      do
        j--;
      while (dists[ids[j]] > tempDist);
      if (j < i) break;
      swap(ids, i, j);
    }
    ids[left + 1] = ids[j], ids[j] = temp, right - i + 1 >= j - left ? (quicksort(ids, dists, i, right), quicksort(ids, dists, left, j - 1)) : (quicksort(ids, dists, left, j - 1), quicksort(ids, dists, i, right));
  }
}
function swap(arr, i, j) {
  let tmp = arr[i];
  arr[i] = arr[j], arr[j] = tmp;
}
function defaultGetX(p) {
  return p[0];
}
function defaultGetY(p) {
  return p[1];
}
export {
  Delaunator as default
};

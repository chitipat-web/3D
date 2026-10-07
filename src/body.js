// Bodywork: nose with twin LED headlights, windscreen, side & lower fairings,
// fuel tank, seats, tail, front fender, mirrors, lights.
import * as THREE from 'three';
import {
  DEG, kf, loft, mirrorRing, mirrorCreases, mirrorZ, merge, combine, sweep, rrect, rbox, cyl, rod, tube, place, shape, extrude, lerp, clamp, smooth,
} from './geom.js';
import { FA, RA, PF, SD, forkAt } from './layout.js';
import { mesh } from './chassis.js';
import { SIDE_BOX, TAIL_BOX, gaugeTexture, headlightTexture } from './decals.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const uvSideBox = (B) => (p) => [(p[0] - B.X0) / (B.X1 - B.X0), (p[1] - B.Y0) / (B.Y1 - B.Y0)];

// Shrink a ring towards its centroid (for rounded end caps).
function shrink(ring, k, dy = 0) {
  const c = ring.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / ring.length);
  return ring.map((p) => [p[0], c[1] + (p[1] - c[1]) * k + dy, p[2] * k]);
}

// ===========================================================================
// Design sheet (side view lines, metres)
// ===========================================================================
export const TANK = {
  top: kf([[-0.16, 0.868], [-0.1, 0.888], [-0.02, 0.922], [0.06, 0.952], [0.16, 0.969], [0.24, 0.968], [0.31, 0.955], [0.37, 0.928], [0.415, 0.898], [0.445, 0.872]]),
  bot: kf([[-0.16, 0.808], [0.0, 0.79], [0.15, 0.786], [0.3, 0.79], [0.445, 0.802]]),
  w: kf([[-0.16, 0.098], [-0.08, 0.122], [0.0, 0.148], [0.1, 0.176], [0.22, 0.197], [0.33, 0.19], [0.4, 0.16], [0.445, 0.115]]),
};

const SEAT = {
  top: kf([[-0.08, 0.878], [-0.13, 0.858], [-0.22, 0.836], [-0.32, 0.831], [-0.42, 0.838], [-0.49, 0.855], [-0.52, 0.866]]),
  w: kf([[-0.08, 0.075], [-0.13, 0.112], [-0.22, 0.138], [-0.35, 0.14], [-0.45, 0.13], [-0.52, 0.112]]),
};
const PILLION = {
  top: kf([[-0.505, 0.9], [-0.55, 0.922], [-0.64, 0.932], [-0.72, 0.928], [-0.755, 0.915]]),
  w: kf([[-0.505, 0.095], [-0.6, 0.094], [-0.7, 0.08], [-0.755, 0.068]]),
};
const TAIL = {
  // top edge of the side panels (meets the seats), then the exposed tail top
  up: kf([[-0.17, 0.8], [-0.3, 0.792], [-0.42, 0.8], [-0.5, 0.83], [-0.56, 0.876], [-0.66, 0.89], [-0.76, 0.898], [-0.86, 0.927], [-0.95, 0.962], [-0.99, 0.975]]),
  low: kf([[-0.17, 0.705], [-0.32, 0.708], [-0.48, 0.728], [-0.64, 0.762], [-0.8, 0.812], [-0.92, 0.86], [-0.99, 0.895]]),
  w: kf([[-0.17, 0.168], [-0.35, 0.16], [-0.5, 0.148], [-0.65, 0.124], [-0.8, 0.095], [-0.92, 0.072], [-0.99, 0.048]]),
};

// Side fairing outline: top edge and bottom/front edge (rear -> front)
// top edge starts with the diagonal rear edge (clutch cover stays exposed)
const SIDE_T = [
  [-0.105, 0.25], [-0.03, 0.305], [0.035, 0.375], [0.085, 0.455], [0.115, 0.58], [0.15, 0.72], [0.18, 0.786], [0.26, 0.787], [0.35, 0.795], [0.45, 0.81],
  [0.55, 0.832], [0.63, 0.852], [0.7, 0.864], [0.78, 0.868],
];
const SIDE_B = [
  [-0.105, 0.25], [-0.095, 0.215], [-0.04, 0.195], [0.06, 0.186], [0.2, 0.186], [0.31, 0.198], [0.36, 0.245], [0.358, 0.33], [0.383, 0.43], [0.44, 0.53],
  [0.53, 0.612], [0.62, 0.66], [0.7, 0.692], [0.77, 0.716], [0.82, 0.73],
];
const SIDE_W = kf([[-0.13, 0.19], [-0.02, 0.208], [0.12, 0.226], [0.28, 0.238], [0.42, 0.247], [0.56, 0.25], [0.66, 0.248], [0.74, 0.242], [0.82, 0.232]]);
const SIDE_TOPY = kf([[0.0, 0.786], [0.18, 0.786], [0.26, 0.787], [0.35, 0.795], [0.45, 0.81], [0.55, 0.832], [0.63, 0.852], [0.7, 0.864]]);

function resample(poly, n) {
  const P = poly.map(([x, y]) => new THREE.Vector2(x, y));
  const L = [0];
  for (let i = 1; i < P.length; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  const total = L[L.length - 1];
  const out = [];
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const d = (total * i) / n;
    while (k < P.length - 2 && L[k + 1] < d) k++;
    const t = (d - L[k]) / Math.max(1e-9, L[k + 1] - L[k]);
    out.push(P[k].clone().lerp(P[k + 1], clamp(t, 0, 1)));
  }
  return out;
}

// Lateral offset of the side fairing skin at side-view point (x, y).
export function sideHull(x, y) {
  const yt = SIDE_TOPY(clamp(x, 0.005, 0.7));
  const yb = 0.186;
  const eta = clamp((y - yb) / (yt - yb), 0, 1);
  let z = SIDE_W(x) * (0.84 + 0.16 * Math.pow(Math.sin(Math.PI * clamp(eta * 0.92 + 0.06, 0, 1)), 0.55));
  // tuck in under the tank
  if (x < 0.46) {
    const tz = TANK.w(Math.max(x, -0.16)) * 0.87 + 0.012;
    const k = smooth(0.72, 1.0, eta) * smooth(0.5, 0.4, x);
    z = lerp(z, tz, k);
  }
  // character line: upper panel stands proud of the lower one
  const lineY = lerp(0.6, 0.735, clamp((x - 0.02) / 0.68, 0, 1));
  z += 0.009 * smooth(-0.006, 0.006, y - lineY) * smooth(0.0, 0.08, x);
  // tuck under the belly
  z *= 0.9 + 0.1 * smooth(0.186, 0.26, y);
  return z;
}

function sideSkin(nu = 96, nv = 46) {
  const T = resample(SIDE_T, nu);
  const B = resample(SIDE_B, nu);
  const rings = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const ring = [];
    for (let i = 0; i <= nu; i++) {
      const p = T[i].clone().lerp(B[i], v);
      ring.push([p.x, p.y, sideHull(p.x, p.y)]);
    }
    rings.push(ring);
  }
  // inward return along the front edge (wheel arch) so the fairing reads as a solid shell
  for (const [k, inset] of [[1, 0.012], [2, 0.045]]) {
    const ring = [];
    for (let i = 0; i <= nu; i++) {
      const b = B[i];
      const front = smooth(0.3, 0.36, b.x) * smooth(0.26, 0.32, b.y);
      const n = (rings[nv][i][2] - inset * front * (k === 2 ? 1 : 1)) ;
      const back = 0.004 * k * front;
      ring.push([b.x - back, b.y + (k === 2 ? 0.004 : 0.0) * front, front > 0 ? n : rings[nv][i][2] - 0.001 * k]);
    }
    rings.push(ring);
  }
  return loft(rings, { su: 1, sv: 1, uv: uvSideBox(SIDE_BOX) });
}

function bellyPan() {
  const xs = linspace(-0.105, 0.35, 16);
  const yb = kf([[-0.105, 0.222], [-0.05, 0.196], [0.06, 0.186], [0.2, 0.186], [0.31, 0.198], [0.35, 0.235]]);
  const rings = xs.map((x) => {
    const y = yb(x);
    const z = sideHull(x, y);
    const half = [[x, y - 0.036, 0], [x, y - 0.034, z * 0.5], [x, y - 0.022, z * 0.86], [x, y - 0.006, z * 0.985], [x, y, z]];
    return mirrorRing(half);
  });
  return loft(rings, { su: 3, sv: 2, uv: uvSideBox(SIDE_BOX) });
}

// ===========================================================================
// Nose / upper cowl
// ===========================================================================
const N = {
  // centre line (top of the beak, dips under the windscreen)
  yC: kf([[0.655, 0.875], [0.72, 0.86], [0.8, 0.85], [0.88, 0.862], [0.93, 0.882], [0.95, 0.858], [0.968, 0.83], [0.982, 0.806], [0.99, 0.792]]),
  // windscreen base line
  zS: kf([[0.655, 0.212], [0.72, 0.2], [0.8, 0.168], [0.88, 0.1], [0.93, 0.01], [0.99, 0.006]]),
  yS: kf([[0.655, 0.936], [0.72, 0.928], [0.8, 0.914], [0.88, 0.897], [0.93, 0.883], [0.95, 0.862], [0.968, 0.836], [0.99, 0.794]]),
  // brow crease (top edge of the headlight)
  zB: kf([[0.655, 0.236], [0.72, 0.238], [0.8, 0.236], [0.858, 0.228], [0.9, 0.185], [0.94, 0.122], [0.965, 0.068], [0.982, 0.034], [0.99, 0.016]]),
  yB: kf([[0.655, 0.902], [0.72, 0.896], [0.8, 0.888], [0.858, 0.877], [0.9, 0.86], [0.94, 0.838], [0.965, 0.815], [0.99, 0.79]]),
  // chin crease (bottom edge of the headlight)
  zC: kf([[0.655, 0.266], [0.72, 0.268], [0.8, 0.264], [0.858, 0.242], [0.9, 0.196], [0.94, 0.132], [0.965, 0.078], [0.982, 0.042], [0.99, 0.02]]),
  yC2: kf([[0.655, 0.792], [0.72, 0.793], [0.8, 0.795], [0.858, 0.797], [0.9, 0.79], [0.94, 0.781], [0.965, 0.773], [0.99, 0.768]]),
  // lower edge of the cowl
  zE: kf([[0.655, 0.256], [0.72, 0.254], [0.8, 0.244], [0.858, 0.212], [0.9, 0.165], [0.94, 0.1], [0.965, 0.054], [0.99, 0.0]]),
  yE: kf([[0.655, 0.7], [0.72, 0.712], [0.8, 0.726], [0.858, 0.736], [0.94, 0.744], [0.99, 0.75]]),
};

function noseRing(x) {
  const yC = N.yC(x);
  const zS = N.zS(x);
  const yS = N.yS(x);
  const zB = N.zB(x);
  const yB = N.yB(x);
  const zC = N.zC(x);
  const yC2 = N.yC2(x);
  const zD = zC + 0.003;
  const yD = yC2 - 0.022;
  const zE = N.zE(x);
  const yE = N.yE(x);
  const under = x < 0.93 ? -0.035 * smooth(0.93, 0.87, x) : 0; // dip under the windscreen
  const half = [
    [x, yC + under, 0],
    [x, lerp(yC + under, yS, 0.6) + 0.003, zS * 0.55],
    [x, yS, zS],
    [x, (yS + yB) / 2 + 0.006, (zS + zB) / 2],
    [x, yB, zB],
    [x, (yB + yC2) / 2, (zB + zC) / 2 - 0.002],
    [x, yC2, zC],
    [x, yD, zD],
    [x, (yD + yE) / 2, (zD + zE) / 2 - 0.006],
    [x, yE, zE],
  ];
  return mirrorRing(half);
}

const NOSE_X = [0.99, 0.986, 0.978, 0.965, 0.952, 0.94, 0.93, 0.9, 0.858, 0.83, 0.805, 0.775, 0.745, 0.715, 0.685, 0.655];
const NOSE_ROW_CREASE = [3, 6, 8, 11];

function buildNose(M, hlMat) {
  const rings = NOSE_X.map((x) => noseRing(x));
  // pointed beak: collapse the very first ring onto the centre line
  rings[0] = rings[0].map((p) => [p[0], p[1], p[2] * 0.15]);
  const colCreases = mirrorCreases([2, 4, 6, 7], 10);
  // material ids: 0 primary, 1 body, 2 headlight, 3 plastic
  // 4 = right side decal, 5 = left side decal (cheeks behind the headlights)
  const matFn = (ri, ci) => {
    const side = ci <= 4 ? ci : 8 - ci; // 0 under, 1 lip, 2 face, 3 top, 4 centre
    if (side === 0) return 3;
    if (side === 1) return ri <= 3 ? 0 : 1;
    if (side === 2) return ri === 0 ? 0 : ri <= 2 ? 2 : ci > 4 ? 4 : 5;
    if (side === 3) return 0;
    return ri <= 1 ? 0 : 3;
  };
  const sideUV = uvSideBox(SIDE_BOX);
  const uvFn = (p, ri, ci) => {
    if (ri >= 3) return sideUV(p);
    const x = p[0];
    const u = clamp((0.965 - x) / 0.107, 0, 1);
    const yb = N.yB(x);
    const yc = N.yC2(x);
    return [u, clamp((p[1] - yc) / Math.max(0.01, yb - yc), 0, 1)];
  };
  const g = loft(rings, { creaseCols: colCreases, creaseRows: NOSE_ROW_CREASE, su: 4, sv: 3, mat: matFn, uv: uvFn });
  const m = new THREE.Mesh(g, [M.primary, M.body, hlMat, M.plasticGloss, M.decalSide, M.decalSideL]);
  m.name = 'UpperCowl';
  return m;
}

// ram-air intake: dark trapezoid on the beak front, right under the windscreen
function buildIntake(M) {
  const xs = linspace(0.931, 0.962, 7);
  const rings = xs.map((x) => {
    const t = (x - 0.931) / 0.031;
    const hw = lerp(0.07, 0.03, t);
    const y = N.yC(x) + 0.003;
    return [[x - 0.004, y - 0.004, -hw], [x, y, -hw * 0.55], [x + 0.001, y + 0.001, 0], [x, y, hw * 0.55], [x - 0.004, y - 0.004, hw]];
  });
  const g = loft(rings, { su: 2, sv: 2 });
  return mesh(g, M.mesh, 'RamAirIntake');
}

function buildWindscreen(M) {
  const nT = 24;
  const nV = 10;
  const rings = [];
  for (let j = 0; j <= nV; j++) {
    const v = j / nV;
    const ring = [];
    for (let i = 0; i <= nT; i++) {
      const t = -1 + (2 * i) / nT;
      const xl = 0.93 - 0.275 * Math.pow(Math.abs(t), 0.9);
      const L = v3(xl + 0.002, N.yS(xl) + 0.003, Math.sign(t) * N.zS(xl));
      const U = v3(0.6 + 0.018 * t * t, 1.098 - 0.04 * t * t, 0.17 * t);
      const p = L.clone().lerp(U, v);
      const bulge = 0.03 * 4 * v * (1 - v) * (1 - 0.4 * t * t);
      p.x += bulge * 0.55;
      p.y += bulge * 0.83;
      p.z *= 1 + 0.08 * Math.sin(Math.PI * v);
      ring.push([p.x, p.y, p.z]);
    }
    rings.push(ring);
  }
  const g = loft(rings, { su: 2, sv: 2 });
  const m = mesh(g, M.screen, 'Windscreen');
  m.renderOrder = 2;
  return m;
}

function buildInnerFairing(M) {
  const xs = linspace(0.672, 0.47, 7);
  const rings = xs.map((x) => {
    const t = (0.672 - x) / 0.202;
    const w = lerp(0.248, 0.13, Math.pow(t, 0.8));
    const yTop = lerp(0.9, 0.87, t);
    const yLow = lerp(0.705, 0.76, t);
    const half = [[x, yTop - 0.02, 0], [x, yTop, w * 0.45], [x, yTop - 0.015, w * 0.85], [x, (yTop + yLow) / 2, w], [x, yLow, w * 0.97]];
    return mirrorRing(half);
  });
  return mesh(loft(rings, { su: 3, sv: 2 }), M.plastic, 'InnerFairing');
}

function buildInstruments(M) {
  const grp = new THREE.Group();
  grp.name = 'Instruments';
  const housing = rbox(0.045, 0.088, 0.18, 0.012);
  const hm = mesh(housing, M.plastic, 'GaugeHousing');
  grp.add(hm);
  const tex = gaugeTexture();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.166, 0.078),
    new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: tex ? 0.55 : 0, roughness: 0.25, color: tex ? '#ffffff' : '#111' })
  );
  face.name = 'GaugeFace';
  face.rotation.y = -Math.PI / 2;
  face.position.x = -0.0255;
  grp.add(face);
  grp.position.set(0.545, 0.925, 0);
  grp.rotation.z = -52 * DEG;
  return grp;
}

// ===========================================================================
// Tank, seats, tail
// ===========================================================================
function tankRing(x) {
  const yt = TANK.top(x);
  const yb = TANK.bot(x);
  const w = TANK.w(x);
  const h = yt - yb;
  const knee = 0.06 * smooth(0.12, -0.02, x) * smooth(-0.17, -0.1, x);
  const half = [
    [x, yt, 0], [x, yt - 0.003, 0.48 * w], [x, yt - 0.022, 0.82 * w], [x, yb + 0.6 * h, w * (1 - knee * 0.5)], [x, yb + 0.25 * h, 0.975 * w * (1 - knee)], [x, yb, 0.88 * w * (1 - knee)],
  ];
  return mirrorRing(half);
}

function buildTank(M) {
  const xs = linspace(0.445, -0.16, 20);
  const rings = xs.map(tankRing);
  rings.unshift(shrink(tankRing(0.451), 0.62, -0.006));
  rings.push(shrink(tankRing(-0.168), 0.6, -0.01));
  const g = loft(rings, { su: 4, sv: 2, creaseCols: mirrorCreases([2], 6) });
  const m = mesh(g, M.primary, 'FuelTank');
  // filler cap
  const yCap = TANK.top(0.13) + 0.0012;
  const ring = place(cyl(0.043, 0.044, 0.005, 40), { p: [0.13, yCap, 0] });
  const lid = place(cyl(0.031, 0.033, 0.004, 40), { p: [0.13, yCap + 0.003, 0] });
  const capG = new THREE.Group();
  capG.name = 'FuelCap';
  capG.add(mesh(ring, M.alu, 'FuelCapRing'), mesh(lid, M.plasticGloss, 'FuelCapLid'));
  const grp = new THREE.Group();
  grp.name = 'Tank';
  grp.add(m, capG);
  return grp;
}

function seatRing(x, S, thick) {
  const yt = S.top(x);
  const w = S.w(x);
  const half = [[x, yt, 0], [x, yt - 0.002, 0.5 * w], [x, yt - 0.01, 0.84 * w], [x, yt - 0.03, w], [x, yt - thick * 0.75, 0.97 * w], [x, yt - thick, 0.88 * w]];
  return mirrorRing(half);
}

function buildSeats(M) {
  const grp = new THREE.Group();
  grp.name = 'Seats';
  const xs = linspace(-0.08, -0.52, 16);
  const rings = xs.map((x) => seatRing(x, SEAT, 0.075));
  rings.unshift(shrink(seatRing(-0.072, SEAT, 0.075), 0.5, -0.01));
  rings.push(shrink(seatRing(-0.528, SEAT, 0.075), 0.7, -0.012));
  grp.add(mesh(loft(rings, { su: 4, sv: 2 }), M.seat, 'RiderSeat'));
  const xp = linspace(-0.505, -0.755, 10);
  const pr = xp.map((x) => seatRing(x, PILLION, 0.065));
  pr.unshift(shrink(seatRing(-0.498, PILLION, 0.065), 0.55, -0.01));
  pr.push(shrink(seatRing(-0.762, PILLION, 0.065), 0.6, -0.008));
  grp.add(mesh(loft(pr, { su: 4, sv: 2 }), M.seat, 'PillionSeat'));
  return grp;
}

function tailRing(x) {
  const yU = TAIL.up(x);
  const yL = TAIL.low(x);
  const w = TAIL.w(x);
  const h = yU - yL;
  // under the seats the top is hidden: keep it below the seat surface
  const seatY = x > -0.52 ? SEAT.top(Math.max(-0.52, x)) - 0.045 : x > -0.755 ? PILLION.top(x) - 0.04 : yU + 0.012;
  const yTopC = Math.min(seatY, yU + 0.012);
  const half = [
    [x, yTopC, 0],
    [x, lerp(yTopC, yU, 0.6), 0.55 * w],
    [x, yU, 0.88 * w],
    [x, yU - 0.25 * h, w],
    [x, yL + 0.3 * h, 0.96 * w],
    [x, yL, 0.8 * w],
  ];
  return mirrorRing(half);
}

function buildTail(M, decalMatR, decalMatL) {
  const xs = linspace(-0.17, -0.99, 22);
  const rings = xs.map(tailRing);
  rings.push(shrink(tailRing(-0.996), 0.55, -0.004));
  const creases = mirrorCreases([2, 3], 6);
  // col spans for 11-pt ring with creases at 2,3,7,8 -> [0,2],[2,3],[3,7],[7,8],[8,10]
  const matFn = (ri, ci) => (ci === 0 ? 1 : ci === 4 ? 2 : 0);
  const g = loft(rings, { creaseCols: creases, su: 4, sv: 2, mat: matFn, uv: uvSideBox(TAIL_BOX) });
  // material 1 = left side decal, 2 = right side decal, 0 = primary
  const m = new THREE.Mesh(g, [M.primary, decalMatL, decalMatR]);
  m.name = 'TailCowl';
  return m;
}

function buildTailLights(M) {
  const grp = new THREE.Group();
  grp.name = 'TailLights';
  // LED tail light: slim lens wrapped under the tail tip
  {
    const xs = linspace(-0.915, -0.992, 7);
    const rings = xs.map((x) => {
      const y = TAIL.low(x) + 0.004;
      const w = TAIL.w(x) * 0.78;
      return [[x, y + 0.012, -w], [x, y - 0.004, -w * 0.6], [x, y - 0.008, 0], [x, y - 0.004, w * 0.6], [x, y + 0.012, w]];
    });
    grp.add(mesh(loft(rings, { su: 3, sv: 2 }), M.lensRed, 'TailLightLens'));
    const leds = [];
    for (const s of [-1, 1]) leds.push(rod(v3(-0.925, TAIL.low(-0.925) + 0.002, s * 0.05), v3(-0.985, TAIL.low(-0.985) + 0.001, s * 0.025), 0.0035, 8));
    leds.push(rod(v3(-0.955, TAIL.low(-0.955) - 0.0, -0.035), v3(-0.955, TAIL.low(-0.955) - 0.0, 0.035), 0.0035, 8));
    grp.add(mesh(merge(leds), M.ledRed, 'TailLightLED'));
  }
  // undertray
  const xs = linspace(-0.6, -0.95, 8);
  const rings = xs.map((x) => {
    const y = TAIL.low(x) - 0.003;
    const w = TAIL.w(x) * 0.8;
    return [[x, y, -w], [x, y - 0.012, -w * 0.5], [x, y - 0.016, 0], [x, y - 0.012, w * 0.5], [x, y, w]];
  });
  grp.add(mesh(loft(rings, { su: 3, sv: 2 }), M.plastic, 'Undertray'));
  // licence plate holder: arm from the undertray down to the plate bracket
  const arm = sweep([v3(-0.8, 0.818, 0), v3(-0.9, 0.765, 0), v3(-0.972, 0.703, 0)], (t) => rrect(0.013, lerp(0.125, 0.1, t), 0.005, 2), {
    steps: 12,
    up: v3(0, 1, 0),
  });
  grp.add(mesh(arm, M.plastic, 'PlateHolder'));
  const tilt = -0.2;
  const bracket = place(rbox(0.01, 0.15, 0.19, 0.004), { p: [-0.987, 0.632, 0], r: [0, 0, tilt] });
  grp.add(mesh(bracket, M.plastic, 'PlateBracket'));
  const refl = place(rbox(0.008, 0.02, 0.07, 0.004), { p: [-1.0, 0.548, 0], r: [0, 0, tilt] });
  grp.add(mesh(refl, M.reflector, 'RearReflector'));
  // rear turn signals on stalks from the holder arm
  const stalks = [];
  const lensG = [];
  for (const s of [-1, 1]) {
    stalks.push(rod(v3(-0.95, 0.723, s * 0.045), v3(-0.955, 0.727, s * 0.122), 0.0055, 10));
    lensG.push(place(rbox(0.048, 0.024, 0.028, 0.009), { p: [-0.962, 0.729, s * 0.136] }));
  }
  grp.add(mesh(merge(stalks), M.plastic, 'RearSignalStalks'));
  grp.add(mesh(merge(lensG), M.amber, 'RearSignals'));
  return grp;
}

// ===========================================================================
// Front fender, mirrors, front signals, headlight inners
// ===========================================================================
function buildFender(M) {
  const grp = new THREE.Group();
  grp.name = 'FrontFender';
  const angs = linspace(44, 121, 16).map((a) => a * DEG);
  const rings = angs.map((a, i) => {
    const t = i / (angs.length - 1);
    const k = 0.55 + 0.45 * smooth(0, 0.3, t) - 0.08 * smooth(0.85, 1, t);
    const lift = 0.008 * (1 - smooth(0, 0.25, t));
    const half = [[0, 0.318 + lift], [0.028 * k, 0.316 + lift * 0.8], [0.05 * k, 0.309], [0.062 * k, 0.3], [0.066 * k, 0.289]];
    return mirrorRing(half.map(([z, r]) => [FA.x + r * Math.cos(a), FA.y + r * Math.sin(a), z]));
  });
  const g = loft(rings, { su: 3, sv: 2, creaseCols: [4] });
  grp.add(mesh(g, M.primary, 'Fender'));
  // fender side stays that run down the front of the fork legs
  const fins = [];
  for (const s of [-1, 1]) {
    const path = [];
    for (let i = 0; i <= 8; i++) {
      const sAx = lerp(0.335, 0.11, i / 8);
      const p = forkAt(sAx).addScaledVector(PF, 0.03 + 0.004 * Math.sin((Math.PI * i) / 8));
      p.z = s * 0.106;
      path.push(p);
    }
    fins.push(sweep(path, (t) => rrect(0.006, lerp(0.05, 0.03, t), 0.0025, 2), { steps: 16, up: PF.clone() }));
  }
  grp.add(mesh(merge(fins), M.primary, 'ForkGuards'));
  return grp;
}

function buildMirrors(M) {
  const grp = new THREE.Group();
  grp.name = 'Mirrors';
  const stalks = [];
  const shells = [];
  const glass = [];
  for (const s of [-1, 1]) {
    const base = v3(0.735, 0.902, s * 0.238);
    const top = v3(0.69, 0.99, s * 0.262);
    stalks.push(sweep([base, base.clone().lerp(top, 0.5).add(v3(0, 0, s * 0.01)), top], () => rrect(0.012, 0.022, 0.005, 2), { steps: 10, up: v3(1, 0, 0) }));
    // housing: angular shell (rounded box, tapered towards the front)
    const c = v3(0.668, 1.012, s * 0.298);
    const hb = rbox(0.036, 0.054, 0.12, 0.012, 3);
    const pos = hb.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const k = 1 - 0.18 * clamp(x / 0.02, 0, 1);
      pos.setY(i, pos.getY(i) * k + (pos.getZ(i) * s > 0 ? 0.004 : -0.004) * (pos.getY(i) > 0 ? 1 : 0));
      pos.setZ(i, pos.getZ(i) * k);
    }
    hb.computeVertexNormals();
    hb.rotateX(s * 0.08);
    hb.translate(c.x, c.y, c.z);
    shells.push(hb);
    const gl = new THREE.PlaneGeometry(0.104, 0.044);
    gl.rotateY(-Math.PI / 2);
    gl.translate(c.x - 0.0185 + 0.0015, c.y, c.z);
    glass.push(gl);
  }
  grp.add(mesh(merge(stalks), M.plastic, 'MirrorStalks'));
  grp.add(mesh(merge(shells), M.plasticGloss, 'MirrorHousings'));
  grp.add(mesh(merge(glass), M.chrome, 'MirrorGlass'));
  return grp;
}

function buildFrontSignals(M) {
  const lenses = [];
  const bulbs = [];
  for (const s of [-1, 1]) {
    const x = 0.69;
    const y = 0.705;
    const z = sideHull(x, y) * s;
    lenses.push(place(rbox(0.06, 0.028, 0.02, 0.008), { p: [x, y, z + s * 0.004], r: [0, 0, -0.35] }));
    bulbs.push(place(rbox(0.03, 0.012, 0.012, 0.004), { p: [x + 0.004, y, z + s * 0.002], r: [0, 0, -0.35] }));
  }
  const grp = new THREE.Group();
  grp.name = 'FrontSignals';
  grp.add(mesh(merge(lenses), M.lens, 'FrontSignalLens'));
  grp.add(mesh(merge(bulbs), M.amber, 'FrontSignalBulb'));
  return grp;
}

// ===========================================================================
export function buildBodywork(M, livery) {
  const grp = new THREE.Group();
  grp.name = 'Bodywork';
  // headlight material (lens over reflectors with LED strip)
  const hlTex = headlightTexture(false);
  const hlGlow = headlightTexture(true);
  const hlMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: hlTex, emissiveMap: hlGlow, emissive: '#ffffff', emissiveIntensity: hlTex ? 1.6 : 0, roughness: 0.12, metalness: 0.55, clearcoat: 1,
    clearcoatRoughness: 0.02, side: THREE.DoubleSide,
  });
  hlMat.name = 'headlight';
  M.headlight = hlMat;
  const decalR = M.decalSide;
  const decalL = M.decalSide.clone();
  decalL.name = 'decalSideL';
  M.decalSideL = decalL;
  const tailR = M.decalTail;
  const tailL = M.decalTail.clone();
  tailL.name = 'decalTailL';
  M.decalTailL = tailL;

  grp.add(buildNose(M, hlMat));
  {
    const rings = linspace(0.66, 0.79, 3).map((y) => {
      const t = (y - 0.66) / 0.13;
      const hw = lerp(0.17, 0.22, t);
      const x = 0.775 + 0.04 * t;
      return [[x - 0.03, y, -hw], [x, y, -hw * 0.5], [x + 0.012, y, 0], [x, y, hw * 0.5], [x - 0.03, y, hw]];
    });
    grp.add(mesh(loft(rings, { su: 3, sv: 2 }), M.plastic, 'HeadlightBacks'));
  }
  grp.add(buildIntake(M));
  grp.add(buildWindscreen(M));
  grp.add(buildInnerFairing(M));
  grp.add(buildInstruments(M));

  const skin = sideSkin();
  const right = mesh(skin, decalR, 'SideFairingRight');
  const left = mesh(mirrorZ(skin), decalL, 'SideFairingLeft');
  grp.add(right, left);
  grp.add(mesh(bellyPan(), M.body, 'BellyPan'));

  grp.add(buildTank(M));
  grp.add(buildSeats(M));
  grp.add(buildTail(M, tailR, tailL));
  grp.add(buildTailLights(M));
  grp.add(buildFender(M));
  grp.add(buildMirrors(M));
  grp.add(buildFrontSignals(M));
  return grp;
}

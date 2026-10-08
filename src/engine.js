// 636 cc inline-four, radiator and exhaust system.
import * as THREE from 'three';
import { DEG, sweep, rrect, shape, circlePts, extrude, rbox, cyl, rod, tube, place, merge, latheZ, loft } from './geom.js';
import { CRANK, CYL_DIR, CYL_FWD, SPROCKET_F } from './layout.js';
import { mesh } from './chassis.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const segPts = (A, B, n) => Array.from({ length: n + 1 }, (_, i) => A.clone().lerp(B, i / n));
const at = (d, f = 0, z = 0) => CRANK.clone().addScaledVector(CYL_DIR, d).addScaledVector(CYL_FWD, f).setZ(z);

function finTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2b2e';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#0c0c0d';
  for (let x = 0; x < 256; x += 4) g.fillRect(x, 0, 2, 256);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 256, 3);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Cast engine side cover facing +z (s = 1) or -z (s = -1): straight wall,
// chamfered edge, flat face with a low central boss.
function sideCover(cx, cy, z0, r, depth, s) {
  const prof = [
    [r, 0], [r, depth * 0.55], [r * 0.97, depth * 0.72], [r * 0.9, depth * 0.78], [r * 0.42, depth * 0.8], [r * 0.38, depth * 0.94], [r * 0.3, depth],
    [0.0001, depth],
  ];
  const g = latheZ(prof, 48);
  if (s < 0) g.scale(1, 1, -1).index && flipIdx(g);
  g.translate(cx, cy, z0);
  return g;
}
function flipIdx(g) {
  const a = g.index.array;
  for (let i = 0; i < a.length; i += 3) {
    const t = a[i + 1];
    a[i + 1] = a[i + 2];
    a[i + 2] = t;
  }
  g.computeVertexNormals();
  return g;
}

export function buildEngine(M) {
  const grp = new THREE.Group();
  grp.name = 'Engine';
  const dy = CRANK.y - 0.335;
  const Y = (pts) => pts.map(([x, y]) => [x, y + dy]);
  const dark = [];
  const silver = [];
  const black = [];
  const bolts = [];

  // crankcase (side profile extruded across the engine)
  const caseProfile = [
    [0.225, 0.2], [0.247, 0.255], [0.248, 0.33], [0.232, 0.395], [0.2, 0.432], [0.12, 0.452], [0.02, 0.47], [-0.06, 0.468],
    [-0.105, 0.44], [-0.115, 0.37], [-0.105, 0.27], [-0.07, 0.205], [-0.02, 0.19], [0.18, 0.19],
  ];
  dark.push(extrude(shape(Y(caseProfile)), 0.31, 0.014, 3, 8));
  // sump
  dark.push(extrude(shape(Y([[0.19, 0.2], [0.19, 0.19], [0.165, 0.172], [0.01, 0.172], [-0.02, 0.19], [-0.02, 0.2]])), 0.2, 0.006, 2, 4));
  // cylinder block, head and cam cover, tilted forward 30 deg
  const tilt = (g, d, f = 0) => {
    g.rotateZ(-30 * DEG);
    const p = at(d, f);
    g.translate(p.x, p.y, 0);
    return g;
  };
  silver.push(tilt(rbox(0.112, 0.15, 0.33, 0.014), 0.13));
  silver.push(tilt(rbox(0.142, 0.085, 0.338, 0.016), 0.245, 0.004));
  black.push(tilt(rbox(0.125, 0.05, 0.3, 0.02), 0.305, -0.004));
  // cam cover ribs
  for (const z of [-0.105, -0.035, 0.035, 0.105]) silver.push(tilt(rbox(0.07, 0.012, 0.012, 0.004), 0.332, -0.01).translate(0, 0, z));
  // plug coils
  for (const z of [-0.105, -0.035, 0.035, 0.105]) black.push(tilt(cyl(0.012, 0.012, 0.03, 12), 0.34, -0.012).translate(0, 0, z));

  // right side: clutch cover + crank-end cover (black cast, machined rims)
  const covers = [];
  const rims = [];
  const cover = (cx, cy, z0, r, depth, sd) => {
    covers.push(sideCover(cx, cy, z0, r, depth, sd));
    const rim = new THREE.TorusGeometry(r * 0.93, 0.0028, 6, 48);
    rim.translate(cx, cy, z0 + sd * depth * 0.76);
    rims.push(rim);
  };
  cover(0.0, 0.425, 0.155, 0.088, 0.034, 1);
  cover(0.13, 0.4, 0.155, 0.056, 0.03, 1);
  cover(0.06, 0.465, 0.155, 0.03, 0.024, 1);
  // left side: alternator cover + starter clutch cover
  cover(0.11, 0.41, -0.155, 0.068, 0.034, -1);
  cover(0.02, 0.45, -0.155, 0.04, 0.028, -1);
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + 0.2;
    bolts.push(place(cyl(0.0055, 0.0055, 0.008, 6), { r: [Math.PI / 2, 0, 0], p: [0.0 + 0.094 * Math.cos(a), 0.425 + 0.094 * Math.sin(a), 0.184] }));
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    bolts.push(place(cyl(0.005, 0.005, 0.008, 6), { r: [Math.PI / 2, 0, 0], p: [0.11 + 0.074 * Math.cos(a), 0.41 + 0.074 * Math.sin(a), -0.184] }));
  }
  // sprocket cover (left)
  black.push(extrude(shape(Y([[-0.115, 0.44], [-0.02, 0.445], [0.01, 0.4], [-0.005, 0.33], [-0.06, 0.31], [-0.115, 0.33]])), 0.025, 0.006, 2, 4).translate(0, 0, -0.17));
  // oil filter + water pump
  black.push(place(cyl(0.034, 0.034, 0.07, 24), { r: [0, 0, -1.1], p: [0.25, 0.235 + dy, 0.05] }));
  silver.push(place(cyl(0.04, 0.04, 0.03, 24), { r: [Math.PI / 2, 0, 0], p: [0.19, 0.25 + dy, -0.17] }));
  // throttle bodies / intake (behind the head, mostly hidden)
  for (const z of [-0.105, -0.035, 0.035, 0.105]) black.push(rod(at(0.26, -0.07, z), at(0.37, -0.12, z), 0.019, 14));
  // starter motor
  black.push(place(cyl(0.028, 0.028, 0.12, 18), { r: [Math.PI / 2, 0, 0], p: [0.02, 0.475 + dy, -0.06] }));

  grp.add(mesh(merge(dark), M.engineDark, 'Crankcase'));
  grp.add(mesh(merge(silver), M.engine, 'CylinderBlock'));
  grp.add(mesh(merge(covers), M.engineBlack, 'EngineCovers'));
  grp.add(mesh(merge(rims), M.alu, 'CoverRims'));
  grp.add(mesh(merge(black), M.engineBlack, 'EngineBlack'));
  grp.add(mesh(merge(bolts), M.bolt, 'EngineBolts'));

  // ---- radiator
  const rad = new THREE.Group();
  rad.name = 'Radiator';
  const core = rbox(0.036, 0.32, 0.37, 0.006);
  const coreMat = M.radiator.clone();
  const ft = finTexture();
  if (ft) coreMat.map = ft;
  const coreMesh = mesh(core, coreMat, 'RadiatorCore');
  coreMesh.rotation.z = 8 * DEG;
  coreMesh.position.set(0.352, 0.555, 0);
  rad.add(coreMesh);
  const tanks = [];
  for (const s of [-1, 1]) tanks.push(place(rbox(0.05, 0.33, 0.035, 0.008), { p: [0.35, 0.555, s * 0.2], r: [0, 0, 8 * DEG] }));
  tanks.push(place(rbox(0.05, 0.03, 0.42, 0.008), { p: [0.33, 0.725, 0], r: [0, 0, 8 * DEG] }));
  tanks.push(place(rbox(0.05, 0.03, 0.42, 0.008), { p: [0.375, 0.39, 0], r: [0, 0, 8 * DEG] }));
  rad.add(mesh(merge(tanks), M.plastic, 'RadiatorTanks'));
  // hoses
  const hoses = [
    tube([v3(0.33, 0.7, 0.16), v3(0.29, 0.69, 0.16), v3(0.26, 0.62, 0.14)], 0.014, 16, 10),
    tube([v3(0.37, 0.41, -0.17), v3(0.3, 0.33, -0.18), v3(0.21, 0.3, -0.18)], 0.014, 16, 10),
  ];
  rad.add(mesh(merge(hoses), M.rubber, 'CoolantHoses'));
  grp.add(rad);
  return grp;
}

// Muffler cross-section (a = up, b = inward)
function mufflerSection(scale = 1) {
  const p = [
    [0.074, -0.034], [0.074, 0.03], [0.05, 0.056], [-0.04, 0.058], [-0.072, 0.032], [-0.072, -0.03], [-0.045, -0.06], [0.046, -0.062],
  ];
  return p.map(([a, b]) => [a * scale, b * scale]);
}

export function buildExhaust(M) {
  const grp = new THREE.Group();
  grp.name = 'Exhaust';
  const headers = [];
  const zs = [-0.105, -0.035, 0.035, 0.105];
  for (const zi of zs) {
    const p0 = at(0.215, 0.065, zi);
    const pts = [
      p0,
      p0.clone().add(v3(0.03, -0.025, 0)),
      v3(0.336, 0.4, zi),
      v3(0.338, 0.33, zi * 0.92),
      v3(0.315, 0.255, zi * 0.82),
      v3(0.265, 0.19, zi * 0.66),
      v3(0.19, 0.158, zi * 0.45),
      v3(0.11, 0.15, zi * 0.28),
      v3(0.07, 0.152, zi * 0.2),
    ];
    headers.push(tube(pts, 0.0185, 60, 14));
  }
  grp.add(mesh(merge(headers), M.exhaustHot, 'Headers'));
  // pre-chamber (catalyser box) under the engine
  const chamber = loft(
    [-0.25, -0.2, -0.1, 0.0, 0.06, 0.09].map((x, i, arr) => {
      const t = i / (arr.length - 1);
      const w = 0.105 * (t < 0.1 ? 0.8 : 1) * (t > 0.85 ? 0.7 : 1);
      const yb = 0.132;
      const yt = 0.205 - (t > 0.85 ? 0.02 : 0);
      return [
        [x, yt, 0], [x, yt - 0.004, w * 0.7], [x, (yt + yb) / 2 + 0.01, w], [x, yb + 0.012, w * 0.8], [x, yb, 0],
        [x, yb + 0.012, -w * 0.8], [x, (yt + yb) / 2 + 0.01, -w], [x, yt - 0.004, -w * 0.7],
      ];
    }),
    { closed: true, su: 4, sv: 3 }
  );
  grp.add(mesh(chamber, M.exhaustHot, 'PreChamber'));
  // link pipe from the pre-chamber up to the silencer
  grp.add(mesh(tube([v3(-0.235, 0.18, 0.085), v3(-0.29, 0.235, 0.13), v3(-0.335, 0.3, 0.16), v3(-0.37, 0.345, 0.17)], 0.026, 30, 14), M.exhaustHot, 'LinkPipe'));

  // stock silencer: brushed stainless canister angled up towards the tail
  // (traced from the right-side studio photo)
  const A = v3(-0.548, 0.42, 0.176);
  const B = v3(-0.88, 0.558, 0.176);
  const dir = B.clone().sub(A).normalize();
  const sec = (k = 1) => rrect(0.172 * k, 0.122 * k, 0.034 * k, 4);
  const body = sweep(segPts(A, B, 12), () => sec(1), { steps: 12, up: v3(0, 1, 0), spline: false });
  grp.add(mesh(body, M.brushed, 'Silencer'));
  // rear end cap with an angled face and outlet
  const capA = B.clone().addScaledVector(dir, -0.004);
  const capB = B.clone().addScaledVector(dir, 0.026);
  const cap = sweep(segPts(capA, capB, 3), (t) => sec(1.012 - 0.06 * t), { steps: 3, up: v3(0, 1, 0), spline: false });
  grp.add(mesh(cap, M.engineBlack, 'SilencerEndCap'));
  const outlet = cyl(0.026, 0.026, 0.012, 24);
  outlet.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir));
  const op = capB.clone().addScaledVector(dir, 0.002).add(v3(0, -0.02, 0));
  outlet.translate(op.x, op.y, op.z);
  grp.add(mesh(outlet, M.exhaustTip, 'SilencerOutlet'));
  // black front cone/heat shield tapering into the link pipe
  const F0 = v3(-0.36, 0.337, 0.17);
  const F1 = A.clone().addScaledVector(dir, 0.03);
  const cone = sweep(segPts(F0, F1, 10), (t) => {
    const k = 0.3 + 0.72 * Math.pow(t, 0.7);
    return sec(k);
  }, { steps: 10, up: v3(0, 1, 0), spline: false });
  grp.add(mesh(cone, M.engineBlack, 'SilencerCone'));
  // hanger to the pillion footpeg bracket
  grp.add(mesh(rod(v3(-0.66, 0.565, 0.165), v3(-0.55, 0.615, 0.138), 0.009, 8), M.frame, 'SilencerHanger'));
  return grp;
}

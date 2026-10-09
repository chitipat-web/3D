// 636 cc inline-four, radiator and exhaust system.
import * as THREE from 'three';
import { DEG, sweep, rrect, shape, circlePts, extrude, rbox, cyl, rod, tube, place, merge, latheZ, loft, mirrorZ, clamp } from './geom.js';
import { buildPanel } from './panel.js';
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
function sideCover(cx, cy, z0, r, depth, s, boss = 0.38) {
  const prof = [
    [r, 0], [r, depth * 0.55], [r * 0.97, depth * 0.72], [r * 0.9, depth * 0.78], [r * (boss + 0.04), depth * 0.8], [r * boss, depth * 0.9], [r * boss * 0.8, depth * 0.93],
    [0.0001, depth * 0.93],
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

  // Cast side covers, placed from the 2019 studio side photos: on the right
  // the big ribbed clutch cover with the oil filler and, above and ahead of
  // it, the crank-end cover with two inspection plugs; on the left the
  // alternator cover. Satin cast finish, machined rims, bolt circles.
  const covers = [];
  const rims = [];
  const cover = (cx, cy, z0, r, depth, sd, nBolts = 0, boltR = r * 1.07, boss = 0.38) => {
    covers.push(sideCover(cx, cy, z0, r, depth, sd, boss));
    const rim = new THREE.TorusGeometry(r * 0.93, 0.0028, 6, 48);
    rim.translate(cx, cy, z0 + sd * depth * 0.76);
    rims.push(rim);
    const face = z0 + sd * depth * 0.55;
    for (let k = 0; k < nBolts; k++) {
      const a = (k / nBolts) * Math.PI * 2 + 0.2;
      bolts.push(place(cyl(0.0052, 0.0052, 0.008, 6), { r: [Math.PI / 2, 0, 0], p: [cx + boltR * Math.cos(a), cy + boltR * Math.sin(a), face] }));
    }
  };
  const CL = { x: -0.03, y: 0.41 };
  cover(CL.x, CL.y, 0.155, 0.09, 0.036, 1, 12, 0.096, 0.2);
  cover(0.092, 0.47, 0.155, 0.074, 0.03, 1, 9, 0.079, 0.26);
  cover(0.13, 0.43, -0.155, 0.07, 0.034, -1, 8, 0.075, 0.3);
  // clutch cover: six radial ribs on its face and the oil filler cap
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.35;
    const rib = rbox(0.05, 0.0065, 0.006, 0.002);
    rib.rotateZ(a);
    rib.translate(CL.x + 0.052 * Math.cos(a), CL.y + 0.052 * Math.sin(a), 0.155 + 0.036 * 0.79);
    covers.push(rib);
  }
  black.push(place(cyl(0.015, 0.015, 0.012, 20), { r: [Math.PI / 2, 0, 0], p: [CL.x + 0.004, CL.y + 0.052, 0.155 + 0.036 * 0.82] }));
  rims.push(place(new THREE.TorusGeometry(0.0155, 0.0022, 6, 24), { p: [CL.x + 0.004, CL.y + 0.052, 0.155 + 0.036 * 0.82 + 0.006] }));
  // crank-end cover: timing and crank-turning plugs
  for (const [x, y] of [[0.081, 0.412], [0.106, 0.406]]) black.push(place(cyl(0.0105, 0.0105, 0.01, 18), { r: [Math.PI / 2, 0, 0], p: [x, y, 0.155 + 0.03 * 0.84] }));
  // hoses and wiring round the engine (black rubber), as seen in the photos
  const engineHoses = [
    tube([v3(0.2, 0.545, 0.13), v3(0.12, 0.575, 0.15), v3(0.02, 0.565, 0.155), v3(-0.07, 0.53, 0.15), v3(-0.12, 0.49, 0.14)], 0.011, 32, 10),
    tube([v3(0.24, 0.47, -0.15), v3(0.2, 0.53, -0.16), v3(0.12, 0.56, -0.162), v3(0.04, 0.55, -0.158)], 0.012, 28, 10),
    tube([v3(-0.1, 0.56, 0.12), v3(-0.06, 0.52, 0.16), v3(0.0, 0.505, 0.172), v3(0.05, 0.53, 0.168)], 0.005, 24, 8),
    tube([v3(-0.11, 0.57, -0.12), v3(-0.05, 0.53, -0.17), v3(0.03, 0.52, -0.175)], 0.005, 20, 8),
  ];
  // sprocket cover (left)
  black.push(extrude(shape(Y([[-0.115, 0.44], [-0.02, 0.445], [0.01, 0.4], [-0.005, 0.33], [-0.06, 0.31], [-0.115, 0.33]])), 0.025, 0.006, 2, 4).translate(0, 0, -0.17));
  // oil filter + water pump
  black.push(place(cyl(0.034, 0.034, 0.07, 24), { r: [0, 0, -1.1], p: [0.25, 0.235 + dy, 0.05] }));
  silver.push(place(cyl(0.04, 0.04, 0.03, 24), { r: [Math.PI / 2, 0, 0], p: [0.19, 0.25 + dy, -0.17] }));
  // throttle bodies / intake (behind the head, mostly hidden)
  for (const z of [-0.105, -0.035, 0.035, 0.105]) black.push(rod(at(0.26, -0.07, z), at(0.37, -0.12, z), 0.019, 14));
  // starter motor
  black.push(place(cyl(0.028, 0.028, 0.12, 18), { r: [Math.PI / 2, 0, 0], p: [0.02, 0.475 + dy, -0.06] }));
  // air box under the tank, down over the throttle bodies behind the head
  // (fills the dark space seen between the frame spars on the real bike)
  black.push(
    extrude(shape([[0.27, 0.7], [0.27, 0.8], [0.2, 0.843], [-0.07, 0.843], [-0.1, 0.78], [-0.096, 0.62], [-0.07, 0.535], [-0.02, 0.505], [0.05, 0.5], [0.1, 0.52], [0.17, 0.585], [0.2, 0.632]]), 0.24, 0.012, 2, 6)
  );

  grp.add(mesh(merge(dark), M.engineDark, 'Crankcase'));
  grp.add(mesh(merge(silver), M.engine, 'CylinderBlock'));
  grp.add(mesh(merge(covers), M.engineCover, 'EngineCovers'));
  grp.add(mesh(merge(rims), M.engine, 'CoverRims'));
  grp.add(mesh(merge(black), M.engineBlack, 'EngineBlack'));
  grp.add(mesh(merge(bolts), M.bolt, 'EngineBolts'));
  grp.add(mesh(merge(engineHoses), M.rubber, 'EngineHoses'));

  // ---- radiator
  const rad = new THREE.Group();
  rad.name = 'Radiator';
  const core = rbox(0.036, 0.32, 0.33, 0.006);
  const coreMat = M.radiator.clone();
  const ft = finTexture();
  if (ft) coreMat.map = ft;
  const coreMesh = mesh(core, coreMat, 'RadiatorCore');
  coreMesh.rotation.z = 8 * DEG;
  coreMesh.position.set(0.352, 0.555, 0);
  rad.add(coreMesh);
  const tanks = [];
  // (side tanks kept inside the tucked-in lower edge of the mid panels)
  for (const s of [-1, 1]) tanks.push(place(rbox(0.05, 0.33, 0.03, 0.008), { p: [0.35, 0.555, s * 0.176], r: [0, 0, 8 * DEG] }));
  tanks.push(place(rbox(0.05, 0.03, 0.37, 0.008), { p: [0.33, 0.725, 0], r: [0, 0, 8 * DEG] }));
  tanks.push(place(rbox(0.05, 0.03, 0.36, 0.008), { p: [0.375, 0.39, 0], r: [0, 0, 8 * DEG] }));
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
      v3(0.265, 0.2, zi * 0.66),
      v3(0.19, 0.178, zi * 0.45),
      v3(0.11, 0.172, zi * 0.28),
      v3(0.07, 0.174, zi * 0.2),
    ];
    headers.push(tube(pts, 0.0185, 60, 14));
  }
  grp.add(mesh(merge(headers), M.exhaustHot, 'Headers'));
  // pre-chamber (catalyser box) under the engine and swingarm pivot: its
  // stainless rear end shows below the heat guards in the side photos
  // (box below the swingarm pivot hanging lowest, then a slimmer duct up
  // behind the guards to the collector under the engine)
  const pcx = [-0.37, -0.355, -0.3, -0.27, -0.24, -0.1, -0.05, 0.0, 0.06, 0.09];
  const pyb = [0.15, 0.14, 0.14, 0.145, 0.2, 0.2, 0.18, 0.165, 0.165, 0.175];
  const pw = [0.075, 0.098, 0.105, 0.105, 0.085, 0.085, 0.1, 0.105, 0.1, 0.075];
  const chamber = loft(
    pcx.map((x, i) => {
      const w = pw[i];
      const yb = pyb[i];
      const yt = i === 0 || i === pcx.length - 1 ? 0.215 : 0.235;
      return [
        [x, yt, 0], [x, yt - 0.004, w * 0.7], [x, (yt + yb) / 2 + 0.01, w], [x, yb + 0.012, w * 0.8], [x, yb, 0],
        [x, yb + 0.012, -w * 0.8], [x, (yt + yb) / 2 + 0.01, -w], [x, yt - 0.004, -w * 0.7],
      ];
    }),
    { closed: true, su: 4, sv: 3 }
  );
  grp.add(mesh(chamber, M.chamber, 'PreChamber'));
  // link pipe from the pre-chamber up to the silencer (behind the guard)
  grp.add(mesh(tube([v3(-0.235, 0.215, 0.07), v3(-0.29, 0.255, 0.12), v3(-0.345, 0.312, 0.158), v3(-0.405, 0.368, 0.172)], 0.026, 30, 14), M.engineBlack, 'LinkPipe'));
  // Heat guards (black plastic, traced from the side photos): on the right a
  // long shield runs from the lower fairing back over the pre-chamber and
  // the link pipe up to the silencer's front cover; a lower one covers the
  // left side of the pre-chamber.
  const guards = [];
  guards.push(
    buildPanel({
      outline: [[-0.055, 0.3, 1], [-0.17, 0.314], [-0.3, 0.34], [-0.37, 0.36], [-0.43, 0.364, 1], [-0.455, 0.33], [-0.44, 0.284, 1], [-0.4, 0.252], [-0.33, 0.213], [-0.25, 0.198], [-0.15, 0.19], [-0.055, 0.19, 1]],
      surface: (x, y) => 0.13 + 0.1 * clamp((-0.08 - x) / 0.34, 0, 1) - 0.5 * (y - 0.265) ** 2,
      roll: 0.006, flange: 0.014, spacing: 0.012,
    })
  );
  guards.push(
    mirrorZ(
      buildPanel({
        outline: [[-0.05, 0.29, 1], [-0.2, 0.295], [-0.31, 0.292, 1], [-0.326, 0.25], [-0.31, 0.205, 1], [-0.2, 0.198], [-0.05, 0.195, 1]],
        surface: (x, y) => 0.118 - 0.4 * (y - 0.245) ** 2,
        roll: 0.005, flange: 0.012, spacing: 0.012,
      })
    )
  );
  grp.add(mesh(merge(guards), M.heatGuard, 'HeatGuards'));
  const gb = [];
  for (const [x, y] of [[-0.4, 0.272], [-0.23, 0.206], [-0.335, 0.322]]) {
    const z = 0.13 + 0.1 * clamp((-0.08 - x) / 0.34, 0, 1) - 0.5 * (y - 0.265) ** 2;
    gb.push(place(cyl(0.0075, 0.0075, 0.006, 6), { r: [Math.PI / 2, 0, 0], p: [x, y, z + 0.002] }));
  }
  for (const [x, y] of [[-0.29, 0.25], [-0.09, 0.245]]) gb.push(place(cyl(0.0065, 0.0065, 0.006, 6), { r: [Math.PI / 2, 0, 0], p: [x, y, -(0.118 - 0.4 * (y - 0.245) ** 2) - 0.002] }));
  grp.add(mesh(merge(gb), M.bolt, 'HeatGuardBolts'));

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
  const F0 = v3(-0.405, 0.37, 0.172);
  const F1 = A.clone().addScaledVector(dir, 0.03);
  const cone = sweep(segPts(F0, F1, 10), (t) => {
    const k = 0.6 + 0.42 * Math.pow(t, 0.8);
    return sec(k);
  }, { steps: 10, up: v3(0, 1, 0), spline: false });
  grp.add(mesh(cone, M.engineBlack, 'SilencerCone'));
  // hanger to the pillion footpeg bracket
  grp.add(mesh(rod(v3(-0.66, 0.565, 0.165), v3(-0.55, 0.615, 0.138), 0.009, 8), M.frame, 'SilencerHanger'));
  return grp;
}

// 636 cc inline-four, radiator and exhaust system.
import * as THREE from 'three';
import { DEG, sweep, rrect, shape, circlePts, extrude, rbox, cyl, rod, tube, place, merge, latheZ, loft, mirrorZ, clamp, kf, lerp, flipGeometry } from './geom.js';
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
  g.fillStyle = '#3b3d41';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#141516';
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
// rounded shoulder and a domed face rising to a low central boss (v17: the
// real covers bulge, which is what gives them their graded, bright
// highlights in the studio photos; a flat face lit evenly read as a grey
// disc). coverFace(rho, boss) is the face height (fraction of depth) at
// rho = distance from the centre / r.
const coverFace = (rho, boss) => {
  if (rho >= 0.9) return 0.66 - 0.8 * (rho - 0.9);
  const t = clamp((0.9 - rho) / (0.9 - boss - 0.04), 0, 1);
  return 0.66 + 0.26 * Math.sin((t * Math.PI) / 2) + (rho < boss ? 0.06 : 0);
};
function sideCover(cx, cy, z0, r, depth, s, boss = 0.38) {
  const prof = [[r, 0], [r, depth * 0.42], [r * 0.985, depth * 0.53], [r * 0.95, depth * 0.61], [r * 0.9, depth * 0.66]];
  for (let i = 1; i <= 10; i++) {
    const rho = 0.9 - (0.9 - boss - 0.04) * (i / 10);
    prof.push([r * rho, depth * coverFace(rho, boss)]);
  }
  prof.push([r * boss, depth * 0.94], [r * boss * 0.97, depth * 0.98], [r * boss * 0.8, depth], [0.0001, depth]);
  const g = latheZ(prof, 64);
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
  const engineHoses = [];

  // crankcase (side profile extruded across the engine)
  // (v16: the upper case rises behind the cylinders, filling the opening
  // under the frame casting that both side photos show)
  const caseProfile = [
    [0.225, 0.2], [0.247, 0.255], [0.248, 0.33], [0.232, 0.395], [0.2, 0.432], [0.12, 0.452], [0.06, 0.47], [0.03, 0.505], [-0.04, 0.515],
    [-0.065, 0.475], [-0.1, 0.46], [-0.113, 0.43], [-0.115, 0.37], [-0.105, 0.27], [-0.07, 0.205], [-0.02, 0.19], [0.18, 0.19],
  ];
  // (its lower edge is chamfered in, as on the real cases, so the lower
  // fairing's tucked-under skin clears it)
  const caseG = extrude(shape(Y(caseProfile)), 0.31, 0.014, 3, 8);
  const cp = caseG.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const t = clamp((cp.getY(i) - 0.21) / 0.08, 0, 1);
    cp.setZ(i, cp.getZ(i) * lerp(0.82, 1, t * t * (3 - 2 * t)));
  }
  caseG.computeVertexNormals();
  dark.push(caseG);
  // sump
  dark.push(extrude(shape(Y([[0.19, 0.2], [0.19, 0.19], [0.165, 0.172], [0.01, 0.172], [-0.02, 0.19], [-0.02, 0.2]])), 0.2, 0.006, 2, 4));
  // cylinder block, head and cam cover, tilted forward 30 deg
  const tilt = (g, d, f = 0) => {
    g.rotateZ(-30 * DEG);
    const p = at(d, f);
    g.translate(p.x, p.y, 0);
    return g;
  };
  // (v16: front faces on f = +0.022, as in the naked-chassis photo: there
  // the exhaust ports sit at (0.245, 0.556), the block's front at y 0.5 is
  // at x 0.21 and the head hides behind the frame hanger, leaving the gap
  // in front of it open; the bank sits just inside the hangers)
  silver.push(tilt(rbox(0.078, 0.15, 0.3, 0.012), 0.13, -0.017));
  silver.push(tilt(rbox(0.089, 0.085, 0.302, 0.014), 0.245, -0.0225));
  black.push(tilt(rbox(0.088, 0.05, 0.29, 0.018), 0.305, -0.022));
  // cam cover ribs
  for (const z of [-0.105, -0.035, 0.035, 0.105]) silver.push(tilt(rbox(0.07, 0.012, 0.012, 0.004), 0.332, -0.016).translate(0, 0, z));
  // plug coils
  for (const z of [-0.105, -0.035, 0.035, 0.105]) black.push(tilt(cyl(0.012, 0.012, 0.03, 12), 0.34, -0.012).translate(0, 0, z));

  // Cast side covers, placed from the 2019 studio side photos: on the right
  // the big ribbed clutch cover with the oil filler and, above and ahead of
  // it, the crank-end cover with two inspection plugs; on the left the
  // alternator cover. Satin cast finish, machined rims, bolt circles.
  const covers = [];
  const rims = [];
  // each bolt sits on a cast boss on the cover's rim, which gives the
  // covers their scalloped outline (3/4 photo)
  const cover = (cx, cy, z0, r, depth, sd, nBolts = 0, boltR = r * 1.07, boss = 0.38, a0 = 0.2, rimmed = true) => {
    covers.push(sideCover(cx, cy, z0, r, depth, sd, boss));
    if (rimmed) {
      const rim = new THREE.TorusGeometry(r * 0.93, 0.0026, 6, 64);
      rim.translate(cx, cy, z0 + sd * depth * 0.7);
      rims.push(rim);
    }
    for (let k = 0; k < nBolts; k++) {
      const a = (k / nBolts) * Math.PI * 2 + a0;
      const bx = cx + boltR * Math.cos(a);
      const by = cy + boltR * Math.sin(a);
      covers.push(place(cyl(0.0062, 0.0072, depth * 0.5, 14), { r: [Math.PI / 2, 0, 0], p: [bx, by, z0 + sd * depth * 0.25] }));
      bolts.push(place(cyl(0.0045, 0.0045, 0.005, 6), { r: [Math.PI / 2, 0, 0], p: [bx, by, z0 + sd * (depth * 0.5 + 0.002)] }));
    }
    // face height of this cover at (x, y), for parts that sit on it
    return (x, y) => z0 + sd * depth * coverFace(Math.hypot(x - cx, y - cy) / r, boss);
  };
  // (v17: clutch cover re-placed from the right-side photo, where its
  // ribs converge at (-0.02, 0.375) and its rim runs out to x -0.10; it
  // was 3.5 cm too high and a little too large)
  const CL = { x: -0.025, y: 0.378 };
  const CR = 0.083;
  const clutchZ = cover(CL.x, CL.y, 0.155, CR, 0.04, 1, 12, CR * 1.035, 0.2);
  // crank end (v18, edge map of the right-side photo and the 3/4 photo): a
  // broad low casting whose rim runs from x 0.035 to 0.177 and up to
  // y 0.531, with the two plugs low on its rear side and, on its upper rear
  // part, a raised round cover standing well out (centre bolt at
  // (0.09, 0.497) in the side photo), scalloped by eight bolt bosses
  const crankZ = cover(0.106, 0.46, 0.155, 0.071, 0.02, 1, 0, 0, 0.3, 0, false);
  cover(0.092, 0.492, 0.155, 0.038, 0.042, 1, 8, 0.0395, 0.26, 1.18);
  bolts.push(place(cyl(0.0055, 0.0055, 0.006, 6), { r: [Math.PI / 2, 0, 0], p: [0.092, 0.492, 0.155 + 0.042 + 0.002] }));
  cover(0.13, 0.43, -0.155, 0.07, 0.034, -1, 8, 0.0725, 0.3);
  // clutch cover: six short radial ribs following the dome
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.35;
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const rr = lerp(0.03, 0.07, i / 6);
      const x = CL.x + rr * Math.cos(a);
      const y = CL.y + rr * Math.sin(a);
      pts.push(v3(x, y, clutchZ(x, y) + 0.0012));
    }
    covers.push(sweep(pts, () => rrect(0.006, 0.0045, 0.0018, 2), { steps: 10, up: v3(0, 0, 1) }));
  }
  // oil filler cap at the top of the clutch cover, in a raised neck
  const OF = [CL.x + 0.016, CL.y + 0.067];
  const ofz = clutchZ(OF[0], OF[1]);
  covers.push(place(cyl(0.019, 0.02, 0.012, 24), { r: [Math.PI / 2, 0, 0], p: [OF[0], OF[1], ofz + 0.003] }));
  black.push(place(cyl(0.0145, 0.0145, 0.008, 20), { r: [Math.PI / 2, 0, 0], p: [OF[0], OF[1], ofz + 0.011] }));
  black.push(place(rbox(0.022, 0.005, 0.006, 0.002), { p: [OF[0], OF[1], ofz + 0.016] }));
  // clutch release: a silver tube rising out of the cover's upper rear
  // quarter, with the cable leaving its end up and forward under the frame
  // (3/4 and right-side photos)
  const rl0 = v3(CL.x - 0.032, CL.y + 0.046, clutchZ(CL.x - 0.032, CL.y + 0.046) + 0.004);
  const rl1 = v3(CL.x - 0.062, CL.y + 0.084, rl0.z + 0.012);
  covers.push(rod(rl0, rl1, 0.0078, 16));
  covers.push(place(new THREE.SphereGeometry(0.0078, 12, 8), { p: [rl1.x, rl1.y, rl1.z] }));
  engineHoses.push(tube([rl1.clone().add(v3(0.004, 0.006, 0)), v3(-0.06, 0.49, 0.2), v3(0.02, 0.515, 0.19), v3(0.11, 0.565, 0.17), v3(0.2, 0.615, 0.15)], 0.0042, 40, 8));
  // crank-end cover: timing and crank-turning plugs
  for (const [x, y] of [[0.081, 0.412], [0.106, 0.406]]) black.push(place(cyl(0.0105, 0.0105, 0.01, 18), { r: [Math.PI / 2, 0, 0], p: [x, y, crankZ(x, y) + 0.002] }));
  // hoses and wiring round the engine (black rubber), as seen in the photos
  // (v18: the right-side photo shows a thick dark hose curving up from
  // behind the crank-end casting to the radiator, ahead of the cylinders)
  engineHoses.push(tube([v3(0.15, 0.425, 0.115), v3(0.19, 0.452, 0.12), v3(0.225, 0.484, 0.12), v3(0.255, 0.52, 0.115), v3(0.285, 0.565, 0.108), v3(0.315, 0.6, 0.1)], 0.014, 40, 12));
  engineHoses.push(
    tube([v3(0.24, 0.47, -0.15), v3(0.2, 0.53, -0.16), v3(0.12, 0.56, -0.162), v3(0.04, 0.55, -0.158)], 0.012, 28, 10),
    tube([v3(-0.1, 0.56, 0.12), v3(-0.06, 0.52, 0.16), v3(0.0, 0.505, 0.172), v3(0.05, 0.53, 0.168)], 0.005, 24, 8),
    tube([v3(-0.11, 0.57, -0.12), v3(-0.05, 0.53, -0.17), v3(0.03, 0.52, -0.175)], 0.005, 20, 8),
  );
  // sprocket cover (left)
  // (cast like the crankcase: dark grey in the left photo, not black; a
  // few cast ribs and its bolts break up the face)
  dark.push(extrude(shape(Y([[-0.115, 0.44], [-0.02, 0.445], [0.01, 0.4], [-0.005, 0.33], [-0.06, 0.31], [-0.115, 0.33]])), 0.025, 0.006, 2, 4).translate(0, 0, -0.17));
  for (const [x0, y0, x1, y1] of [[-0.1, 0.46, -0.03, 0.47], [-0.105, 0.425, -0.025, 0.43], [-0.1, 0.39, -0.035, 0.385]]) {
    dark.push(rod(v3(x0, y0, -0.183), v3(x1, y1, -0.183), 0.0035, 6));
  }
  for (const [x, y] of [[-0.108, 0.47], [-0.03, 0.478], [0.0, 0.435], [-0.012, 0.375], [-0.062, 0.355], [-0.108, 0.375]]) {
    bolts.push(place(cyl(0.0048, 0.0048, 0.006, 6), { r: [Math.PI / 2, 0, 0], p: [x, y, -0.184] }));
  }
  // coolant hose down the left side over the sprocket cover, with bright
  // clamps (left photo)
  engineHoses.push(tube([v3(0.11, 0.565, -0.15), v3(0.04, 0.545, -0.168), v3(-0.02, 0.51, -0.188), v3(-0.045, 0.45, -0.192), v3(-0.048, 0.38, -0.19), v3(-0.035, 0.33, -0.175)], 0.0115, 40, 12));
  for (const [x, y, z, ax] of [[0.062, 0.551, -0.163, 1.3], [0.025, 0.538, -0.173, 1.0], [-0.044, 0.43, -0.192, 0.05]]) {
    bolts.push(place(new THREE.TorusGeometry(0.0125, 0.0022, 6, 18), { r: [Math.PI / 2, ax, 0], p: [x, y, z] }));
  }
  // oil filter + water pump
  black.push(place(cyl(0.034, 0.034, 0.07, 24), { r: [0, 0, -1.1], p: [0.212, 0.235 + dy, 0.05] }));
  silver.push(place(cyl(0.04, 0.04, 0.03, 24), { r: [Math.PI / 2, 0, 0], p: [0.19, 0.25 + dy, -0.15] }));
  // throttle bodies / intake (behind the head, mostly hidden)
  for (const z of [-0.105, -0.035, 0.035, 0.105]) black.push(rod(at(0.26, -0.07, z), at(0.37, -0.12, z), 0.019, 14));
  // dark engine internals behind the cylinders and under the air box
  // (throttle bodies, wiring, upper case): in both side photos this is
  // dark, not open to the background
  black.push(place(rbox(0.25, 0.075, 0.2, 0.01), { p: [0.012, 0.565, 0] }));
  black.push(place(rbox(0.09, 0.065, 0.18, 0.01), { p: [0.135, 0.528, 0] }));
  // starter motor: bright cast body across the top of the upper case, just
  // under the frame casting (silver in both side photos)
  silver.push(place(cyl(0.029, 0.029, 0.13, 20), { r: [Math.PI / 2, 0, 0], p: [-0.045, 0.553, 0.035] }));
  black.push(place(cyl(0.031, 0.031, 0.016, 20), { r: [Math.PI / 2, 0, 0], p: [-0.045, 0.553, 0.106] }));
  // air box under the tank, down over the throttle bodies behind the head
  // (fills the dark space seen between the frame spars on the real bike)
  black.push(
    extrude(shape([[0.27, 0.7], [0.27, 0.8], [0.2, 0.843], [-0.07, 0.843], [-0.1, 0.78], [-0.098, 0.66], [-0.075, 0.615], [-0.02, 0.598], [0.05, 0.596], [0.1, 0.6], [0.17, 0.61], [0.2, 0.632]]), 0.24, 0.012, 2, 6)
  );

  grp.add(mesh(merge(dark), M.engineDark, 'Crankcase'));
  grp.add(mesh(merge(silver), M.engine, 'CylinderBlock'));
  grp.add(mesh(merge(covers), M.engineCover, 'EngineCovers'));
  grp.add(mesh(merge(rims), M.engine, 'CoverRims'));
  grp.add(mesh(merge(black), M.engineBlack, 'EngineBlack'));
  grp.add(mesh(merge(bolts), M.bolt, 'EngineBolts'));
  grp.add(mesh(merge(engineHoses), M.rubber, 'EngineHoses'));

  // ---- radiator (v16: traced from the naked-chassis photo: it leans
  // forward at the top by 12 deg and its core bows forward in the middle,
  // so from the side it spans from the end tank at x 0.31-0.35 to the
  // middle of the core at 0.38 (bottom) - 0.45 (top); behind it, between
  // its end tanks and the frame hangers, the bike is open right through,
  // which is what shows through the fairing vents)
  const rad = new THREE.Group();
  rad.name = 'Radiator';
  const RT = 12 * DEG;
  const RO = v3(0.348, 0.62, 0); // rear face of the end tanks, upper part
  const bow = (z) => 0.045 * (1 - Math.min(1, (z / 0.17) ** 2));
  // box in radiator space (a forward, b up along the core, z across)
  const radBox = (a0, a1, b0, b1, z0, z1, segZ = 1, bowed = true) => {
    const g = new THREE.BoxGeometry(a1 - a0, b1 - b0, z1 - z0, 1, 1, segZ);
    g.translate((a0 + a1) / 2, (b0 + b1) / 2, (z0 + z1) / 2);
    if (bowed) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + bow(p.getZ(i)));
    }
    g.rotateZ(-RT);
    g.translate(RO.x, RO.y, 0);
    g.computeVertexNormals();
    return g;
  };
  const radPt = (a, b, z) => v3(RO.x + a * Math.cos(RT) + b * Math.sin(RT), RO.y - a * Math.sin(RT) + b * Math.cos(RT), z);
  const coreMat = M.radiator.clone();
  const ft = finTexture();
  // (the fin texture carries the darkness; a dark base colour on top of it
  // made the core read near black, where the photos show dark grey)
  if (ft) {
    coreMat.map = ft;
    coreMat.color.set('#ffffff');
  }
  rad.add(mesh(radBox(0.004, 0.044, -0.2, 0.05, -0.165, 0.165, 24), coreMat, 'RadiatorCore'));
  const tanks = [];
  for (const s of [-1, 1]) tanks.push(radBox(0, 0.048, -0.212, 0.062, s > 0 ? 0.162 : -0.19, s > 0 ? 0.19 : -0.162, 1, false));
  tanks.push(radBox(0, 0.048, 0.05, 0.075, -0.19, 0.19, 24));
  tanks.push(radBox(0, 0.048, -0.222, -0.2, -0.19, 0.19, 24));
  // brackets up to the frame and a slim bracket along each end tank's
  // rear edge (the dark bar between the two openings of each vent)
  for (const s of [-1, 1]) {
    tanks.push(place(rbox(0.024, 0.05, 0.012, 0.004), { p: [0.386, 0.708, s * 0.1] }));
    tanks.push(rod(v3(0.313, 0.55, s * 0.172), v3(0.339, 0.664, s * 0.172), 0.0055, 8));
  }
  rad.add(mesh(merge(tanks), M.plastic, 'RadiatorTanks'));
  // hoses: top tank round over the vent to the thermostat on the head,
  // bottom tank to the water pump on the left
  const top = radPt(0.024, 0.062, 0.15);
  const bot = radPt(0.024, -0.212, -0.15);
  const hoses = [
    tube([top, v3(0.35, 0.69, 0.115), v3(0.29, 0.69, 0.1), v3(0.24, 0.655, 0.09)], 0.014, 20, 10),
    tube([bot, v3(0.29, 0.36, -0.165), v3(0.22, 0.31, -0.17)], 0.014, 16, 10),
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
  // (v16: traced from the naked-chassis photo: out of the ports at
  // (0.245, 0.556), down the front of the engine at x 0.25-0.30 and round
  // under it, clear of the radiator, which sits well ahead of them)
  // the four pipes fan out in the lower bend (seen from the side they
  // spread over 6-9 cm there), tucked just under the radiator's bottom
  for (const [k, zi] of zs.entries()) {
    const p0 = at(0.215, 0.028, zi);
    const fan = [0.022, 0.008, -0.008, -0.022][k];
    const pts = [
      p0,
      v3(0.266, 0.523, zi),
      v3(0.279, 0.46, zi),
      v3(0.282, 0.4, zi * 0.97),
      v3(0.298 + 0.6 * fan, 0.34, zi * 0.93),
      v3(0.31 + fan, 0.29, zi * 0.88),
      v3(0.296 + fan, 0.25, zi * 0.8),
      v3(0.262 + 0.5 * fan, 0.222, zi * 0.7),
      v3(0.2, 0.2, zi * 0.5),
      v3(0.11, 0.197, zi * 0.28),
      v3(0.07, 0.198, zi * 0.2),
    ];
    headers.push(tube(pts, 0.0185, 60, 14));
  }
  grp.add(mesh(merge(headers), M.exhaustHot, 'Headers'));
  // pre-chamber (catalyser box) under the engine and swingarm pivot: its
  // stainless rear end shows below the heat guards in the side photos
  // (box below the swingarm pivot hanging lowest, then a slimmer duct up
  // behind the guards to the collector under the engine)
  // (v14: the collector runs on forward to x 0.17 under the headers; the
  // side photos show it below the lower fairing's edge from x -0.1 to 0.17)
  const pcx = [-0.37, -0.355, -0.3, -0.27, -0.24, -0.15, -0.1, -0.05, 0.0, 0.06, 0.11, 0.15, 0.175];
  const pyb = [0.15, 0.14, 0.14, 0.145, 0.19, 0.19, 0.175, 0.16, 0.158, 0.16, 0.164, 0.167, 0.174];
  const pw = [0.075, 0.098, 0.105, 0.105, 0.085, 0.085, 0.09, 0.1, 0.105, 0.1, 0.09, 0.08, 0.066];
  const pyt = [0.215, 0.235, 0.235, 0.235, 0.235, 0.235, 0.235, 0.235, 0.235, 0.23, 0.217, 0.207, 0.197];
  const chamber = loft(
    pcx.map((x, i) => {
      const w = pw[i];
      const yb = pyb[i];
      const yt = pyt[i];
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
      // (v14: re-traced lower at the back, where it stays level down to
      // y 0.21 in front of the tyre; a lower step in front over the collector)
      // (v18: behind the pedal it rises to just under the swing arm, as in
      // the right-side photo; through the gap under the swing arm the left
      // photo shows it too)
      outline: [[-0.06, 0.302, 1], [-0.15, 0.298], [-0.205, 0.295, 1], [-0.228, 0.31], [-0.25, 0.336, 1], [-0.29, 0.36], [-0.34, 0.362], [-0.385, 0.346], [-0.42, 0.321], [-0.445, 0.303, 1], [-0.455, 0.27], [-0.449, 0.235], [-0.432, 0.214, 1], [-0.36, 0.205], [-0.25, 0.198], [-0.15, 0.193], [-0.06, 0.193, 1]],
      surface: (x, y) => 0.13 + 0.1 * clamp((-0.08 - x) / 0.34, 0, 1) - 0.5 * (y - 0.265) ** 2,
      roll: 0.006, flange: 0.014, spacing: 0.012,
    })
  );
  guards.push(
    mirrorZ(
      buildPanel({
        outline: [[-0.07, 0.258, 1], [-0.2, 0.262], [-0.31, 0.262, 1], [-0.326, 0.24], [-0.31, 0.205, 1], [-0.2, 0.198], [-0.07, 0.195, 1]],
        surface: (x, y) => 0.118 - 0.4 * (y - 0.245) ** 2,
        roll: 0.005, flange: 0.012, spacing: 0.012,
      })
    )
  );
  grp.add(mesh(merge(guards), M.heatGuard, 'HeatGuards'));
  const gb = [];
  for (const [x, y] of [[-0.39, 0.247], [-0.193, 0.203], [-0.289, 0.312]]) {
    const z = 0.13 + 0.1 * clamp((-0.08 - x) / 0.34, 0, 1) - 0.5 * (y - 0.265) ** 2;
    gb.push(place(cyl(0.0075, 0.0075, 0.006, 6), { r: [Math.PI / 2, 0, 0], p: [x, y, z + 0.002] }));
  }
  for (const [x, y] of [[-0.23, 0.243], [-0.3, 0.245]]) gb.push(place(cyl(0.0065, 0.0065, 0.006, 6), { r: [Math.PI / 2, 0, 0], p: [x, y, -(0.118 - 0.4 * (y - 0.245) ** 2) - 0.002] }));
  grp.add(mesh(merge(gb), M.bolt, 'HeatGuardBolts'));

  // stock silencer: brushed stainless canister angled up towards the tail
  // (traced from the right-side studio photo). Its rear end is cut back
  // underneath into a chamfered "beak" and finished with a polished rim
  // round a dark face and a rounded-triangle outlet (side, rear and rear 3/4
  // photos).
  // (v19: re-traced from a close crop of the right-side photo: the canister
  // tapers slightly, 17 cm deep at the front and 15.5 cm at the back, its
  // top runs from (-0.65, 0.563) to (-0.83, 0.632) and its axis is 1 cm
  // higher than before; at the back its top corner is cut away at 45 deg
  // down to (-0.9, 0.565) and the face below stands upright to the bottom
  // corner at (-0.907, 0.505); profiles are in units of the front section,
  // scaled by Hs along the canister)
  const A = v3(-0.548, 0.427, 0.176);
  const B = v3(-0.878, 0.571, 0.176);
  const dir = B.clone().sub(A).normalize();
  const secA = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize(); // section height axis
  const secB = new THREE.Vector3().crossVectors(dir, secA).normalize();
  const H0 = 0.17;
  const Hs = (s) => lerp(H0, 0.155, clamp(s / 0.38, 0, 1));
  const prof = rrect(H0, 0.122, 0.034, 4);
  const S0 = 0.26;
  const C0 = A.clone().addScaledVector(dir, S0);
  const body = sweep(segPts(A, C0, 10), (t) => prof.map(([a, b]) => [(a * Hs(t * S0)) / H0, b]), { steps: 10, up: v3(0, 1, 0), spline: false, caps: false });
  // end: each section point runs on to the cut (shortest at the top, where
  // the corner is chamfered away)
  const sEnd = kf([[-0.085, 0.357], [-0.06, 0.366], [-0.016, 0.378], [0.031, 0.361], [0.085, 0.347]]);
  const at3 = (s, a, b) => A.clone().addScaledVector(dir, s).addScaledVector(secA, (a * Hs(s)) / H0).addScaledVector(secB, b);
  const endRings = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    endRings.push(prof.map(([a, b]) => at3(lerp(S0, sEnd(a), t), a, b).toArray()));
  }
  // orient a loft so its faces point away from (or, for the recess, towards)
  // the silencer axis: probe one vertex's normal against its offset
  const facing = (g, outward) => {
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const i = Math.floor(pos.count / 2);
    const p = new THREE.Vector3().fromBufferAttribute(pos, i);
    const c = A.clone().addScaledVector(dir, p.clone().sub(A).dot(dir));
    const d = new THREE.Vector3().fromBufferAttribute(nrm, i).dot(p.sub(c));
    return (d < 0) === outward ? flipGeometry(g) : g;
  };
  const endSeg = facing(loft(endRings, { closed: true, su: 1, sv: 1 }), true);
  grp.add(mesh(merge([body, endSeg]), M.brushed, 'Silencer'));
  // polished rim, then the recessed dark face
  const inner = (k, rec) => prof.map(([a, b]) => at3(sEnd(a) - rec, a * k, b * k).toArray());
  const rimG = loft([endRings[8], inner(0.97, 0.002), inner(0.84, 0.008)], { closed: true, su: 1, sv: 1 });
  rimG.computeVertexNormals();
  if (rimG.attributes.normal.getX(0) * dir.x + rimG.attributes.normal.getY(0) * dir.y < 0) flipGeometry(rimG); // faces rearwards
  const wallG = facing(loft([inner(0.84, 0.008), inner(0.84, 0.03)], { closed: true, su: 1, sv: 1 }), false);
  const face = inner(0.84, 0.03);
  const fc = face.reduce((acc, p) => [acc[0] + p[0] / face.length, acc[1] + p[1] / face.length, acc[2] + p[2] / face.length], [0, 0, 0]);
  const fpos = [...fc];
  face.forEach((p) => fpos.push(...p));
  const fidx = [];
  for (let i = 0; i < face.length; i++) fidx.push(0, 1 + i, 1 + ((i + 1) % face.length));
  const faceG = new THREE.BufferGeometry();
  faceG.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
  faceG.setIndex(fidx);
  faceG.computeVertexNormals();
  if (new THREE.Vector3().fromBufferAttribute(faceG.attributes.normal, 0).dot(dir) < 0) flipGeometry(faceG);
  grp.add(mesh(rimG, M.exhaustTip, 'SilencerEndCap'));
  grp.add(mesh(merge([wallG, faceG]), M.engineBlack, 'SilencerFace'));
  // rounded-triangle outlet (point down) with a polished lip
  const tri = [];
  const corners = [[0.05, 0.04], [0.05, -0.04], [-0.05, 0.0]];
  for (let c = 0; c < 3; c++) {
    const [a0, b0] = corners[c];
    const [a1, b1] = corners[(c + 1) % 3];
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      tri.push([lerp(a0, a1, t), lerp(b0, b1, t)]);
    }
  }
  const lipPts = tri.map(([a, b]) => at3(sEnd(a) - 0.028, a * 0.86, b * 0.86));
  lipPts.push(lipPts[0].clone());
  grp.add(mesh(tube(lipPts, 0.0035, 60, 6), M.exhaustTip, 'SilencerOutlet'));
  // black front cone/heat shield tapering into the link pipe
  const F0 = v3(-0.405, 0.37, 0.172);
  const F1 = A.clone().addScaledVector(dir, 0.03);
  const cone = sweep(segPts(F0, F1, 10), (t) => {
    // (ends 4.5% over the canister so the joint reads as a clean lip)
    const k = 0.6 + 0.445 * Math.pow(t, 0.8);
    return rrect(Hs(0.03) * k, 0.122 * k, 0.034 * k, 4);
  }, { steps: 10, up: v3(0, 1, 0), spline: false });
  grp.add(mesh(cone, M.engineBlack, 'SilencerCone'));
  // black cover on the top of the canister, toward the wheel, from the cone
  // back; its rear part lifts off as a thin blade, 2 cm clear of the top,
  // and curls down at the tip over the chamfered corner (side photo: blade
  // at (-0.78, 0.635) and (-0.825, 0.66), tip at (-0.853, 0.651); 3/4 photo)
  const gapS = kf([[0.2, -0.003], [0.24, 0.004], [0.3, 0.015], [0.345, 0.021], [0.368, 0.014], [0.385, 0.002]]);
  const cover = sweep(segPts(A.clone().addScaledVector(dir, 0.02), A.clone().addScaledVector(dir, 0.385), 24), (t) => {
    const sc = lerp(0.02, 0.385, t);
    const h = Hs(sc) / 2;
    const w = lerp(0.105, 0.045, clamp((sc - 0.12) / 0.265, 0, 1));
    const g = sc < 0.2 ? -0.003 : gapS(sc);
    return rrect(0.007, w, 0.0025, 2).map(([a, b]) => [a + h + 0.0035 + g, b + 0.057 - w / 2]);
  }, { steps: 24, up: v3(0, 1, 0), spline: false });
  grp.add(mesh(cover, M.engineBlack, 'SilencerCover'));
  // hanger to the pillion footpeg bracket
  grp.add(mesh(rod(v3(-0.66, 0.565, 0.165), v3(-0.55, 0.615, 0.138), 0.009, 8), M.frame, 'SilencerHanger'));
  return grp;
}

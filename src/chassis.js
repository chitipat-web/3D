// Rolling chassis: wheels, tyres, brakes, front suspension and controls.
import * as THREE from 'three';
import {
  DEG, latheZ, sweep, rrect, circle, shape, circlePts, extrude, rbox, cyl, rod, tube, place, merge, combine,
} from './geom.js';
import {
  R_FRONT, R_REAR, FA, RA, SD, PF, OFFSET, forkAt, steerAt, FORK_Z, S_LOWER_CLAMP, S_UPPER_CLAMP, S_FORK_TOP,
} from './layout.js';

const mesh = (g, m, name) => {
  const o = new THREE.Mesh(g, m);
  if (name) o.name = name;
  return o;
};

// ---------------------------------------------------------------------------
// Tyre tread / sidewall texture (bump map) drawn on a canvas.
// ---------------------------------------------------------------------------
function tyreBump(front) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, c.width, c.height);
  // grooves: sweeping S22-style cuts, repeated around the circumference (u) on the tread band (v 0.3..0.7)
  g.strokeStyle = '#303030';
  g.lineCap = 'round';
  const reps = front ? 18 : 20;
  for (let k = 0; k < reps; k++) {
    const u0 = (k / reps) * c.width;
    for (const side of [-1, 1]) {
      g.lineWidth = 5;
      g.beginPath();
      // from near centre outward with a sweep
      const vC = c.height * 0.5;
      g.moveTo(u0 + 10 * side, vC + side * 10);
      g.bezierCurveTo(u0 + 30, vC + side * 30, u0 + 55, vC + side * 52, u0 + 95, vC + side * 74);
      g.stroke();
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(u0 + 60 + 20 * side, vC + side * 28);
      g.bezierCurveTo(u0 + 80, vC + side * 40, u0 + 100, vC + side * 48, u0 + 120, vC + side * 54);
      g.stroke();
    }
  }
  // sidewall rib lines
  g.fillStyle = '#9a9a9a';
  for (const v of [0.07, 0.93]) g.fillRect(0, c.height * v - 2, c.width, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// Petal (wave) brake disc with drilled holes.
// ---------------------------------------------------------------------------
function petalDisc(Rout, Rin, lobes, depth, holeRows) {
  const outer = [];
  const n = lobes * 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 - Math.abs(Math.cos((lobes * a) / 2));
    outer.push([(Rout - depth * Math.pow(w, 0.8)) * Math.cos(a), (Rout - depth * Math.pow(w, 0.8)) * Math.sin(a)]);
  }
  const holes = [circlePts(0, 0, Rin, 72, true)];
  for (let k = 0; k < lobes; k++) {
    const a0 = (k / lobes) * Math.PI * 2;
    for (const [r, offs, hr] of holeRows) {
      for (const o of offs) {
        const a = a0 + o;
        holes.push(circlePts(r * Math.cos(a), r * Math.sin(a), hr, 10, true));
      }
    }
  }
  return shape(outer, holes);
}

function discCarrier(Rout, Rhub, arms) {
  const outer = circlePts(0, 0, Rout, 72);
  const holes = [circlePts(0, 0, Rhub, 40, true)];
  for (let k = 0; k < arms; k++) {
    const a0 = ((k + 0.5) / arms) * Math.PI * 2;
    const win = [];
    const span = (Math.PI * 2) / arms / 2 - 0.12;
    const r1 = Rhub + 0.018;
    const r2 = Rout - 0.012;
    for (let i = 0; i <= 8; i++) win.push([r2 * Math.cos(a0 - span + (2 * span * i) / 8), r2 * Math.sin(a0 - span + (2 * span * i) / 8)]);
    const span1 = span * 0.55;
    for (let i = 8; i >= 0; i--) win.push([r1 * Math.cos(a0 - span1 + (2 * span1 * i) / 8), r1 * Math.sin(a0 - span1 + (2 * span1 * i) / 8)]);
    holes.push(win.reverse());
  }
  return shape(outer, holes);
}

// ---------------------------------------------------------------------------
// Wheel assembly (tyre, rim, spokes, hub, discs, sprocket). Built at origin,
// axle along Z.
// ---------------------------------------------------------------------------
export function buildWheel(M, front) {
  const grp = new THREE.Group();
  grp.name = front ? 'FrontWheel' : 'RearWheel';
  const R = front ? R_FRONT : R_REAR;
  const tw = front ? 0.06 : 0.09;
  const rw = front ? 0.0445 : 0.07;
  const rho = front ? 0.0664 : 0.104;
  const phi = (front ? 60.8 : 56.8) * DEG;
  const bead = 0.2165;

  // --- tyre
  const sw = front
    ? [[bead, 0.046], [0.222, 0.0525], [0.23, 0.0575], [0.24, 0.0598], [0.25, 0.06], [0.258, 0.0595]]
    : [[bead, 0.0715], [0.222, 0.079], [0.23, 0.085], [0.24, 0.0885], [0.25, 0.09], [0.259, 0.0895]];
  const prof = [];
  sw.forEach(([r, z]) => prof.push([r, -z]));
  const arcN = 22;
  for (let i = 0; i <= arcN; i++) {
    const f = -phi + (2 * phi * i) / arcN;
    prof.push([R - rho * (1 - Math.cos(f)), rho * Math.sin(f)]);
  }
  sw.slice().reverse().forEach(([r, z]) => prof.push([r, z]));
  const tyreG = latheZ(prof, 120);
  const tyreMat = M.tire.clone();
  const bump = tyreBump(front);
  if (bump) {
    tyreMat.bumpMap = bump;
    tyreMat.bumpScale = 1.2;
    bump.repeat.set(1, 1);
  }
  grp.add(mesh(tyreG, tyreMat, 'Tyre'));

  // --- rim (closed section)
  const fl = rw + 0.0055; // flange outer face
  const rimProf = [
    [0.196, -fl + 0.002], [0.197, -fl], [0.226, -fl], [0.2305, -fl + 0.0025], [0.2305, -rw - 0.0005],
    [0.2235, -rw + 0.001], [bead - 0.0005, -rw + 0.003], [bead - 0.0005, -rw * 0.55], [0.205, -rw * 0.3],
    [0.205, rw * 0.3], [bead - 0.0005, rw * 0.55], [bead - 0.0005, rw - 0.003], [0.2235, rw - 0.001],
    [0.2305, rw + 0.0005], [0.2305, fl - 0.0025], [0.226, fl], [0.197, fl], [0.196, fl - 0.002],
    [0.191, rw * 0.6], [0.189, 0], [0.191, -rw * 0.6], [0.196, -fl + 0.002],
  ];
  const rimG = latheZ(rimProf, 120);
  const parts = [rimG];

  // --- spokes (6, gently tapered)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.26;
    const path = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const r = 0.05 + t * (0.193 - 0.05);
      const aa = a + 0.05 * Math.sin(Math.PI * t);
      path.push(new THREE.Vector3(r * Math.cos(aa), r * Math.sin(aa), 0));
    }
    const g = sweep(path, (t) => {
      const depth = THREE.MathUtils.lerp(front ? 0.036 : 0.05, front ? 0.024 : 0.032, t);
      const width = THREE.MathUtils.lerp(0.03, 0.017, Math.pow(t, 0.7)) + 0.012 * Math.pow(t, 6);
      return rrect(depth, width, 0.006, 2);
    }, { steps: 16, up: new THREE.Vector3(0, 0, 1) });
    parts.push(g);
  }
  // hub
  const hw = front ? 0.072 : 0.082;
  const hubProf = [
    [0.012, -hw], [0.03, -hw], [0.034, -hw + 0.006], [0.036, -hw + 0.012], [0.058, -hw + 0.014], [0.06, -hw + 0.03],
    [0.045, -0.02], [0.045, 0.02], [0.06, hw - 0.03], [0.058, hw - 0.014], [0.036, hw - 0.012], [0.034, hw - 0.006],
    [0.03, hw], [0.012, hw],
  ];
  parts.push(latheZ(hubProf, 48));
  grp.add(mesh(merge(parts), M.wheel, 'Rim'));

  // --- rim pin stripes (livery colour)
  const stripeG = [];
  for (const s of [-1, 1]) {
    const ring = new THREE.RingGeometry(0.2085, 0.2135, 120, 1);
    if (s < 0) ring.rotateY(Math.PI);
    ring.translate(0, 0, s * (fl + 0.0004));
    stripeG.push(ring);
  }
  grp.add(mesh(merge(stripeG), M.rimStripe, 'RimStripe'));

  // --- axle stub
  grp.add(mesh(place(cyl(0.0125, 0.0125, front ? 0.27 : 0.31, 20), { r: [Math.PI / 2, 0, 0] }), M.chrome, 'Axle'));

  // --- brake discs
  if (front) {
    const discShape = petalDisc(0.155, 0.104, 12, 0.0065, [
      [0.117, [-0.075, 0.03], 0.0033],
      [0.129, [-0.04, 0.07], 0.0033],
      [0.141, [-0.1, 0.005, 0.11], 0.003],
    ]);
    const discG = extrude(discShape, 0.005, 0, 1, 6);
    const carrierG = extrude(discCarrier(0.106, 0.034, 6), 0.007, 0.0008, 1, 6);
    const discs = [];
    const carriers = [];
    const bobs = [];
    for (const s of [-1, 1]) {
      const z = s * 0.068;
      discs.push(discG.clone().translate(0, 0, z));
      carriers.push(carrierG.clone().translate(0, 0, z - s * 0.002));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        bobs.push(place(cyl(0.0068, 0.0068, 0.011, 14), { r: [Math.PI / 2, 0, 0], p: [0.1045 * Math.cos(a), 0.1045 * Math.sin(a), z] }));
        bobs.push(place(cyl(0.0045, 0.0045, 0.013, 10), { r: [Math.PI / 2, 0, 0], p: [0.05 * Math.cos(a + 0.5), 0.05 * Math.sin(a + 0.5), z - s * 0.002] }));
      }
    }
    grp.add(mesh(merge(discs), M.disc, 'BrakeDiscs'));
    grp.add(mesh(merge(carriers), M.aluDark, 'DiscCarriers'));
    grp.add(mesh(merge(bobs), M.bolt, 'DiscBobbins'));
  } else {
    const discShape = petalDisc(0.11, 0.07, 10, 0.006, [
      [0.081, [-0.09, 0.09], 0.0028],
      [0.093, [-0.04, 0.12], 0.0028],
    ]);
    const discG = extrude(discShape, 0.005, 0, 1, 6).translate(0, 0, 0.09);
    const carrier = extrude(discCarrier(0.072, 0.03, 5), 0.008, 0.0008, 1, 6).translate(0, 0, 0.086);
    grp.add(mesh(discG, M.disc, 'RearDisc'));
    grp.add(mesh(carrier, M.aluDark, 'RearDiscCarrier'));
    // sprocket (43T) on the left
    const teeth = 43;
    const pts = [];
    const rr = 0.1045;
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const da = (Math.PI * 2) / teeth;
      pts.push([(rr - 0.007) * Math.cos(a0), (rr - 0.007) * Math.sin(a0)]);
      pts.push([(rr + 0.002) * Math.cos(a0 + da * 0.32), (rr + 0.002) * Math.sin(a0 + da * 0.32)]);
      pts.push([(rr + 0.002) * Math.cos(a0 + da * 0.55), (rr + 0.002) * Math.sin(a0 + da * 0.55)]);
      pts.push([(rr - 0.007) * Math.cos(a0 + da * 0.85), (rr - 0.007) * Math.sin(a0 + da * 0.85)]);
    }
    const sHoles = [circlePts(0, 0, 0.042, 40, true)];
    for (let k = 0; k < 6; k++) {
      const a = ((k + 0.5) / 6) * Math.PI * 2;
      sHoles.push(circlePts(0.07 * Math.cos(a), 0.07 * Math.sin(a), 0.014, 18, true));
    }
    const spr = extrude(shape(pts, sHoles), 0.006, 0.0005, 1, 4).translate(0, 0, -0.098);
    grp.add(mesh(spr, M.sprocket, 'RearSprocket'));
    // sprocket carrier / cush drive
    const cush = latheZ([[0.03, -0.096], [0.06, -0.096], [0.065, -0.09], [0.065, -0.07], [0.05, -0.065], [0.03, -0.065]], 40);
    grp.add(mesh(cush, M.alu, 'CushDrive'));
  }
  return grp;
}

// ---------------------------------------------------------------------------
// Caliper: arc-shaped monobloc body straddling the disc.
// ---------------------------------------------------------------------------
function caliperBody(rMid, angle, span, zc, axial, radial, round = 0.008) {
  const path = [];
  for (let i = 0; i <= 12; i++) {
    const a = angle - span / 2 + (span * i) / 12;
    path.push(new THREE.Vector3(rMid * Math.cos(a), rMid * Math.sin(a), zc));
  }
  return sweep(path, (t) => {
    const taper = 1 - 0.18 * Math.pow(Math.abs(t - 0.5) * 2, 2);
    return rrect(axial, radial * taper, round, 3);
  }, { steps: 18, up: new THREE.Vector3(0, 0, 1) });
}

function textTexture(text, { w = 512, h = 128, color = '#d8dadd', font = 'italic 800 84px Arial, sans-serif', bg = null } = {}) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = color;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const CAL_ANG = 158 * DEG;

// Rounded bar between two points (w = thickness along Z-ish, h = height).
function beam(A, B, w, h, r = 0.005) {
  const len = A.distanceTo(B);
  const g = rbox(len, h, w, r);
  const dir = new THREE.Vector3().subVectors(B, A).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir));
  const m = A.clone().add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

export function buildFrontBrakes(M) {
  const grp = new THREE.Group();
  grp.name = 'FrontCalipers';
  const ang = CAL_ANG;
  const decalTex = textTexture('NISSIN', { color: '#cfd2d6' });
  for (const s of [-1, 1]) {
    const zc = s * 0.074;
    const body = caliperBody(0.132, ang, 0.86, zc, 0.072, 0.056, 0.01);
    const extra = [];
    // mounting ears at both ends with radial bolts
    for (const da of [-0.43, 0.43]) {
      const a = ang + da;
      extra.push(place(rbox(0.03, 0.028, 0.03, 0.006), { p: [0.124 * Math.cos(a), 0.124 * Math.sin(a), zc + s * 0.024], r: [0, 0, a] }));
    }
    // pad pin
    extra.push(place(cyl(0.004, 0.004, 0.08, 10), { r: [Math.PI / 2, 0, 0], p: [0.16 * Math.cos(ang), 0.16 * Math.sin(ang), zc] }));
    const cal = mesh(merge([body, ...extra]), M.caliper, 'Caliper');
    cal.position.copy(FA);
    grp.add(cal);
    if (decalTex) {
      const d = new THREE.Mesh(
        new THREE.PlaneGeometry(0.07, 0.0175),
        new THREE.MeshStandardMaterial({ map: decalTex, transparent: true, roughness: 0.5, metalness: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
      );
      d.name = 'NissinLogo';
      d.position.set(FA.x + 0.132 * Math.cos(ang), FA.y + 0.132 * Math.sin(ang), zc + s * 0.0368);
      if (s > 0) d.rotation.set(0, 0, ang - Math.PI / 2);
      else d.rotation.set(0, Math.PI, 1.5 * Math.PI - ang);
      grp.add(d);
    }
  }
  // brake hoses: from caliper up to the lower clamp area
  const hoses = [];
  for (const s of [-1, 1]) {
    const a = ang - 0.3;
    const start = new THREE.Vector3(FA.x + 0.16 * Math.cos(a), FA.y + 0.16 * Math.sin(a), s * 0.1);
    const mid1 = forkAt(0.22).add(new THREE.Vector3(-0.055, 0, s * 0.125));
    const mid2 = forkAt(0.4).add(new THREE.Vector3(-0.045, 0, s * 0.1));
    const end = steerAt(S_LOWER_CLAMP - 0.02).add(new THREE.Vector3(0.02, 0, s * 0.02));
    hoses.push(tube([start, mid1, mid2, end], 0.0045, 40, 8));
  }
  grp.add(mesh(merge(hoses), M.rubber, 'BrakeHoses'));
  return grp;
}

export function buildRearBrake(M) {
  const grp = new THREE.Group();
  grp.name = 'RearCaliper';
  const ang = 52 * DEG;
  const body = caliperBody(0.094, ang, 0.7, 0.093, 0.05, 0.045, 0.008);
  const bracket = place(rbox(0.13, 0.03, 0.008, 0.004), { p: [0.06, 0.035, 0.122], r: [0, 0, 0.5] });
  const g = mesh(merge([body, bracket]), M.caliper, 'RearCaliper');
  g.position.copy(RA);
  grp.add(g);
  return grp;
}

// ---------------------------------------------------------------------------
// Front suspension: inverted Showa SFF-BP fork, triple clamps, front axle.
// ---------------------------------------------------------------------------
export function buildFrontEnd(M) {
  const grp = new THREE.Group();
  grp.name = 'FrontFork';
  const outer = [];
  const inner = [];
  const feet = [];
  const caps = [];
  const align = (g, s0, s1, z) => {
    // geometry built along +Y from 0..(s1-s0); orient along SD and move
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SD);
    g.applyQuaternion(q);
    const p = forkAt(s0);
    g.translate(p.x, p.y, z);
    return g;
  };
  for (const s of [-1, 1]) {
    const z = s * FORK_Z;
    // outer tube with seal holder ring at its base
    const prof = [
      [0.0001, 0], [0.0285, 0], [0.0305, 0.004], [0.0305, 0.028], [0.0278, 0.034], [0.0278, S_FORK_TOP - 0.262],
      [0.0255, S_FORK_TOP - 0.255], [0.0001, S_FORK_TOP - 0.255],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    outer.push(align(new THREE.LatheGeometry(prof, 32), 0.262, 0, z));
    inner.push(align(cyl(0.0205, 0.0205, 0.2, 28).translate(0, 0.1, 0), 0.08, 0, z));
    // axle bracket (fork foot)
    const footProf = [
      [0.0001, 0], [0.024, 0], [0.0265, 0.01], [0.0265, 0.12], [0.0235, 0.135], [0.0001, 0.135],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    feet.push(align(new THREE.LatheGeometry(footProf, 28), -0.02, 0, z));
    // axle boss
    feet.push(place(cyl(0.025, 0.025, 0.05, 24), { r: [Math.PI / 2, 0, 0], p: [FA.x, FA.y, s * 0.104] }));
    // radial caliper mounting lugs reaching back from the fork foot
    for (const [sA, th] of [[-0.005, CAL_ANG + 0.43], [0.12, CAL_ANG - 0.43]]) {
      const A = forkAt(sA).addScaledVector(PF, -0.012);
      const B = new THREE.Vector3(FA.x + 0.122 * Math.cos(th), FA.y + 0.122 * Math.sin(th), 0);
      feet.push(beam(new THREE.Vector3(A.x, A.y, s * 0.099), new THREE.Vector3(B.x, B.y, s * 0.099), 0.024, 0.022));
    }
    // fork caps / adjusters
    const topP = forkAt(S_FORK_TOP);
    caps.push(align(cyl(0.0205, 0.0215, 0.016, 6).translate(0, 0.008, 0), S_FORK_TOP, 0, z));
    caps.push(align(cyl(0.008, 0.008, 0.012, 16).translate(0, 0.022, 0), S_FORK_TOP, 0, z));
    void topP;
  }
  grp.add(mesh(merge(outer), M.forkOuter, 'ForkOuterTubes'));
  grp.add(mesh(merge(inner), M.forkInner, 'ForkStanchions'));
  grp.add(mesh(merge(feet), M.forkOuter, 'ForkFeet'));
  grp.add(mesh(merge(caps), M.alu, 'ForkCaps'));

  // axle nut / head
  grp.add(mesh(merge([
    place(cyl(0.02, 0.02, 0.014, 6), { r: [Math.PI / 2, 0, 0], p: [FA.x, FA.y, -0.135] }),
    place(cyl(0.022, 0.022, 0.012, 24), { r: [Math.PI / 2, 0, 0], p: [FA.x, FA.y, 0.134] }),
  ]), M.alu, 'FrontAxleEnds'));

  // triple clamps: plates normal to the steering axis
  const clamp = (sAx, thick, mat, name) => {
    const c = steerAt(sAx);
    const R = 0.036;
    const right = [];
    for (let i = 0; i <= 18; i++) {
      const a = -60 * DEG + (260 * DEG * i) / 18;
      right.push([OFFSET + R * Math.cos(a), FORK_Z + R * Math.sin(a)]);
    }
    right.push([-0.012, 0.062], [-0.032, 0.034]);
    const outline = [...right, [-0.04, 0], ...right.slice().reverse().map(([u, v]) => [u, -v])];
    const g = extrude(shape(outline), thick, 0.003, 2, 8);
    // local x -> PF (forward), y -> -Z, z -> SD (right-handed basis)
    g.applyMatrix4(new THREE.Matrix4().makeBasis(PF, new THREE.Vector3(0, 0, -1), SD));
    g.translate(c.x, c.y, 0);
    return mesh(g, mat, name);
  };
  grp.add(clamp(S_LOWER_CLAMP, 0.032, M.aluDark, 'LowerTripleClamp'));
  grp.add(clamp(S_UPPER_CLAMP, 0.018, M.alu, 'UpperTripleClamp'));
  // steering stem nut
  const stem = steerAt(S_UPPER_CLAMP + 0.012);
  const stemG = cyl(0.017, 0.017, 0.014, 24);
  stemG.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SD));
  stemG.translate(stem.x, stem.y, 0);
  grp.add(mesh(stemG, M.alu, 'StemNut'));
  return grp;
}

function RAKE_Z() {
  return Math.atan2(SD.y, SD.x) - Math.PI / 2;
}

// ---------------------------------------------------------------------------
// Clip-on handlebars, grips, levers, switchgear, master cylinder, mirrors are
// in body.js (the mirrors mount on the fairing).
// ---------------------------------------------------------------------------
export function buildControls(M) {
  const grp = new THREE.Group();
  grp.name = 'Controls';
  const bars = [];
  const grips = [];
  const black = [];
  const levers = [];
  for (const s of [-1, 1]) {
    const c = forkAt(S_UPPER_CLAMP - 0.032);
    const cz = s * FORK_Z;
    // clamp ring
    const ring = cyl(0.034, 0.034, 0.03, 24);
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SD));
    ring.translate(c.x, c.y, cz);
    bars.push(ring);
    // bar: outward, swept back 14 deg, dropping 7 deg
    const dir = new THREE.Vector3(-Math.sin(14 * DEG), -Math.sin(7 * DEG), s).normalize();
    const start = new THREE.Vector3(c.x, c.y, cz).addScaledVector(dir, 0.03);
    const end = new THREE.Vector3(c.x, c.y, cz).addScaledVector(dir, 0.235);
    bars.push(rod(start, end, 0.011, 16));
    const g0 = new THREE.Vector3(c.x, c.y, cz).addScaledVector(dir, 0.108);
    const g1 = new THREE.Vector3(c.x, c.y, cz).addScaledVector(dir, 0.228);
    grips.push(rod(g0, g1, 0.0165, 20));
    // grip flange + bar end
    grips.push(rod(g0.clone().addScaledVector(dir, -0.004), g0.clone().addScaledVector(dir, 0.004), 0.021, 20));
    const be0 = new THREE.Vector3(c.x, c.y, cz).addScaledVector(dir, 0.23);
    const be1 = new THREE.Vector3(c.x, c.y, cz).addScaledVector(dir, 0.252);
    levers.push(rod(be0, be1, 0.0175, 20));
    // switch housing
    const sw = new THREE.Vector3(c.x, c.y, cz).addScaledVector(dir, 0.08);
    const swG = rbox(0.06, 0.05, 0.045, 0.012);
    swG.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
    swG.translate(sw.x - 0.005, sw.y + 0.004, sw.z);
    black.push(swG);
    // lever perch + lever (in front of the grip)
    const perch = new THREE.Vector3(c.x, c.y, cz).addScaledVector(dir, 0.1);
    black.push(place(rbox(0.05, 0.035, 0.035, 0.008), { p: [perch.x + 0.02, perch.y, perch.z] }));
    const lv = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const p = perch.clone().addScaledVector(dir, 0.012 + t * 0.14);
      p.x += 0.045 + 0.012 * Math.sin(Math.PI * t) - 0.01 * t;
      p.y -= 0.005 * t;
      lv.push(p);
    }
    levers.push(sweep(lv, (t) => rrect(0.012, 0.007 - 0.002 * t, 0.003, 2), { steps: 20, up: new THREE.Vector3(0, 1, 0) }));
    if (s > 0) {
      // front brake master cylinder + reservoir
      const mc = perch.clone().add(new THREE.Vector3(0.0, 0.0, -s * 0.035));
      black.push(place(cyl(0.012, 0.012, 0.06, 16), { r: [0, 0, Math.PI / 2], p: [mc.x + 0.005, mc.y + 0.004, mc.z] }));
      // reservoir cup stands well above the bar (it shows over the tank in
      // the side photos): pale cup, black cap
      const res = new THREE.Vector3(c.x - 0.035, c.y + 0.125, cz + s * 0.062);
      black.push(tube([mc.clone().add(new THREE.Vector3(0, 0.012, 0)), mc.clone().add(new THREE.Vector3(-0.02, 0.06, s * 0.03)), res], 0.0045, 16, 8));
      levers.push(place(cyl(0.019, 0.017, 0.04, 20), { p: [res.x, res.y + 0.014, res.z] }));
      black.push(place(cyl(0.0205, 0.0205, 0.009, 20), { p: [res.x, res.y + 0.038, res.z] }));
    } else {
      // clutch cable (disappears behind the fairing)
      const cs = perch.clone().add(new THREE.Vector3(0.02, 0.0, 0.02));
      black.push(tube([cs, cs.clone().add(new THREE.Vector3(0.05, -0.03, 0.03)), new THREE.Vector3(0.42, 0.72, -0.1)], 0.0045, 24, 8));
    }
  }
  grp.add(mesh(merge(bars), M.aluDark, 'ClipOns'));
  grp.add(mesh(merge(grips), M.rubber, 'Grips'));
  grp.add(mesh(merge(black), M.plastic, 'Switchgear'));
  grp.add(mesh(merge(levers), M.alu, 'Levers'));
  return grp;
}

export { mesh, textTexture };

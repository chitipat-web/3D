// Frame, sub-frame, swing-arm, rear suspension, chain, foot controls.
import * as THREE from 'three';
import { DEG, sweep, rrect, circle, shape, circlePts, extrude, rbox, cyl, rod, tube, place, merge, latheZ, loft } from './geom.js';
import { RA, PIVOT, SPROCKET_F, CHAIN_Z, steerAt, S_LOWER_CLAMP, S_UPPER_CLAMP, SD } from './layout.js';
import { mesh } from './chassis.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = v3(0, 1, 0);

function beam(A, B, w, h, r = 0.005) {
  const len = A.distanceTo(B);
  const g = rbox(len, h, w, r);
  const dir = new THREE.Vector3().subVectors(B, A).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir));
  const m = A.clone().add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

// Flat plate from a 2-D outline in the XY plane at depth z.
function plate(pts, z, thick, holes = [], bevel = 0.0015) {
  return extrude(shape(pts, holes), thick, bevel, 1, 6).translate(0, 0, z);
}

export function buildFrame(M) {
  const grp = new THREE.Group();
  grp.name = 'Frame';
  const parts = [];
  // headstock between the triple clamps
  {
    const a = steerAt(S_LOWER_CLAMP + 0.022);
    const b = steerAt(S_UPPER_CLAMP - 0.012);
    parts.push(rod(a, b, 0.031, 24));
  }
  for (const s of [-1, 1]) {
    // main spar: headstock -> around the cylinder head -> pivot casting
    const path = [
      v3(0.445, 0.79, s * 0.03),
      v3(0.39, 0.765, s * 0.085),
      v3(0.3, 0.735, s * 0.135),
      v3(0.16, 0.7, s * 0.152),
      v3(0.02, 0.665, s * 0.152),
      v3(-0.085, 0.632, s * 0.142),
      v3(-0.13, 0.6, s * 0.132),
    ];
    parts.push(
      sweep(path, (t) => rrect(THREE.MathUtils.lerp(0.13, 0.1, t), THREE.MathUtils.lerp(0.05, 0.042, t), 0.012, 3), {
        steps: 40,
        up: UP,
      })
    );
    // pivot section: vertical member down past the swing-arm pivot
    parts.push(
      sweep([v3(-0.118, 0.665, s * 0.13), v3(-0.13, 0.55, s * 0.13), v3(-0.142, 0.44, s * 0.13), v3(-0.152, 0.345, s * 0.128)], (t) =>
        rrect(THREE.MathUtils.lerp(0.11, 0.075, t), 0.044, 0.012, 3), { steps: 24, up: v3(1, 0, 0) })
    );
    // engine hanger down to the cylinder head / crankcase
    parts.push(beam(v3(0.3, 0.725, s * 0.14), v3(0.27, 0.6, s * 0.15), 0.022, 0.04));
    parts.push(beam(v3(-0.13, 0.42, s * 0.13), v3(-0.03, 0.28, s * 0.14), 0.022, 0.035));
    // pivot bolt head
    parts.push(place(cyl(0.024, 0.024, 0.012, 6), { r: [Math.PI / 2, 0, 0], p: [PIVOT.x, PIVOT.y, s * 0.157] }));
  }
  // cross member behind the engine (shock top mount)
  parts.push(place(rbox(0.06, 0.07, 0.24, 0.01), { p: [-0.11, 0.625, 0] }));
  parts.push(place(rbox(0.05, 0.05, 0.24, 0.01), { p: [-0.15, 0.355, 0] }));
  grp.add(mesh(merge(parts), M.frame, 'MainFrame'));

  // ---- sub-frame (seat rails) and pillion peg hangers
  const sub = [];
  for (const s of [-1, 1]) {
    // upper rail runs inside the tail cowl
    sub.push(sweep([v3(-0.12, 0.66, s * 0.11), v3(-0.3, 0.77, s * 0.092), v3(-0.45, 0.8, s * 0.082), v3(-0.6, 0.866, s * 0.07), v3(-0.74, 0.93, s * 0.055)], (t) =>
      rrect(0.03, 0.022, 0.006, 2), { steps: 24, up: UP }));
    sub.push(sweep([v3(-0.15, 0.52, s * 0.115), v3(-0.32, 0.62, s * 0.1), v3(-0.52, 0.765, s * 0.08)], (t) => rrect(0.024, 0.02, 0.006, 2), {
      steps: 16,
      up: UP,
    }));
  }
  sub.push(place(rbox(0.03, 0.025, 0.15, 0.006), { p: [-0.6, 0.866, 0] }));
  sub.push(place(rbox(0.03, 0.025, 0.12, 0.006), { p: [-0.74, 0.93, 0] }));
  grp.add(mesh(merge(sub), M.frame, 'SubFrame'));

  // pillion peg hangers (cast, black) with triangular openings
  const hangers = [];
  for (const s of [-1, 1]) {
    const outline = [[-0.3, 0.705], [-0.37, 0.71], [-0.49, 0.6], [-0.505, 0.575], [-0.48, 0.555], [-0.44, 0.575], [-0.34, 0.65], [-0.29, 0.675]];
    const hole = [[-0.345, 0.675], [-0.44, 0.6], [-0.37, 0.64]];
    hangers.push(plate(outline, s * 0.135, 0.012, [hole], 0.002));
  }
  grp.add(mesh(merge(hangers), M.frame, 'PillionHangers'));
  // pillion pegs
  const ppegs = [];
  for (const s of [-1, 1]) ppegs.push(rod(v3(-0.49, 0.572, s * 0.14), v3(-0.5, 0.572, s * 0.215), 0.011, 12));
  grp.add(mesh(merge(ppegs), M.rubber, 'PillionPegs'));
  return grp;
}

export function buildSwingarm(M) {
  const grp = new THREE.Group();
  grp.name = 'Swingarm';
  const parts = [];
  for (const s of [-1, 1]) {
    const z0 = s * 0.115;
    const z1 = s * 0.132;
    const path = [v3(-0.115, 0.432, z0), v3(-0.3, 0.4, s * 0.126), v3(-0.5, 0.36, z1), v3(-0.735, 0.312, z1)];
    parts.push(
      sweep(path, (t) => {
        const h = THREE.MathUtils.lerp(0.112, 0.064, Math.pow(t, 0.85));
        return rrect(h, 0.044, 0.013, 3);
      }, { steps: 40, up: UP })
    );
    // axle end (chain adjuster slot)
    parts.push(place(rbox(0.07, 0.05, 0.05, 0.008), { p: [RA.x - 0.01, RA.y, s * 0.134] }));
  }
  // pivot tube
  parts.push(place(cyl(0.03, 0.03, 0.235, 24), { r: [Math.PI / 2, 0, 0], p: [PIVOT.x, PIVOT.y, 0] }));
  // cross member + linkage boss
  parts.push(place(rbox(0.08, 0.075, 0.25, 0.012), { p: [-0.215, 0.425, 0], r: [0, 0, -0.15] }));
  parts.push(place(rbox(0.06, 0.05, 0.08, 0.01), { p: [-0.23, 0.37, 0] }));
  grp.add(mesh(merge(parts), M.frame, 'SwingarmBody'));

  // chain adjusters + axle nut
  const adj = [];
  for (const s of [-1, 1]) {
    adj.push(place(rbox(0.032, 0.03, 0.012, 0.004), { p: [RA.x - 0.03, RA.y, s * 0.162] }));
  }
  adj.push(place(cyl(0.022, 0.022, 0.016, 6), { r: [Math.PI / 2, 0, 0], p: [RA.x, RA.y, 0.166] }));
  adj.push(place(cyl(0.02, 0.02, 0.012, 24), { r: [Math.PI / 2, 0, 0], p: [RA.x, RA.y, -0.164] }));
  grp.add(mesh(merge(adj), M.alu, 'ChainAdjusters'));

  // chain slider / guard (black plastic) on the left
  const guard = [];
  guard.push(place(rbox(0.3, 0.012, 0.03, 0.004), { p: [-0.28, 0.452, -0.108], r: [0, 0, -0.14] }));
  // rear hugger over the tyre
  const hug = [];
  const huggerRings = [];
  for (let i = 0; i <= 10; i++) {
    const a = (40 + (85 * i) / 10) * DEG;
    const r = 0.345;
    const ring = [];
    for (let j = 0; j <= 8; j++) {
      const z = -0.1 + (0.2 * j) / 8;
      const lift = 0.012 * (1 - Math.pow(z / 0.1, 2));
      ring.push([RA.x + (r + lift) * Math.cos(a), RA.y + (r + lift) * Math.sin(a), z]);
    }
    huggerRings.push(ring);
  }
  void hug;
  grp.add(mesh(merge(guard), M.plastic, 'ChainSlider'));
  // rear hugger (inner fender) over the front-top of the tyre
  {
    const rings = [];
    for (let i = 0; i <= 12; i++) {
      const a = (58 + (70 * i) / 12) * DEG;
      const ring = [];
      for (let j = 0; j <= 6; j++) {
        const z = -0.105 + (0.21 * j) / 6;
        const r = 0.338 + 0.01 * (1 - Math.pow(z / 0.105, 2));
        ring.push([RA.x + r * Math.cos(a), RA.y + r * Math.sin(a), z]);
      }
      rings.push(ring);
    }
    const hugger = loft(rings, { su: 2, sv: 2 });
    // mounting arm down to the swing-arm
    const arms = [];
    for (const s of [-1, 1]) arms.push(sweep([v3(RA.x + 0.338 * Math.cos(1.05), RA.y + 0.338 * Math.sin(1.05), s * 0.1), v3(-0.5, 0.39, s * 0.115)], () => rrect(0.014, 0.008, 0.003, 1), { steps: 4, up: UP, spline: false }));
    grp.add(mesh(merge([hugger, ...arms]), M.plastic, 'RearHugger'));
  }
  // chain guard over the upper run near the sprocket
  {
    const rings = [];
    for (let i = 0; i <= 6; i++) {
      const x = -0.42 - (0.26 * i) / 6;
      const y = THREE.MathUtils.lerp(0.452, 0.43, i / 6) + 0.012;
      rings.push([[x, y - 0.03, -0.088], [x, y, -0.09], [x, y + 0.006, -0.1], [x, y, -0.112], [x, y - 0.02, -0.114]]);
    }
    grp.add(mesh(loft(rings, { su: 2, sv: 1 }), M.plastic, 'ChainGuard'));
  }
  return { grp, huggerRings };
}

// External tangent points between two circles (upper/lower runs).
function tangentRuns(c1, r1, c2, r2) {
  const d = c2.clone().sub(c1);
  const L = d.length();
  const base = Math.atan2(d.y, d.x);
  const off = Math.acos((r1 - r2) / L);
  const up = base + off; // normal angle for the upper run
  const dn = base - off;
  const p = (c, r, a) => v3(c.x + r * Math.cos(a), c.y + r * Math.sin(a), 0);
  return { upper: [p(c1, r1, up), p(c2, r2, up)], lower: [p(c1, r1, dn), p(c2, r2, dn)], up, dn };
}

export function buildChain(M) {
  const grp = new THREE.Group();
  grp.name = 'Drive';
  const F = v3(SPROCKET_F.x, SPROCKET_F.y, 0);
  const R = v3(RA.x, RA.y, 0);
  const rf = 0.0395; // 15T 525 pitch
  const rr = 0.1045; // 43T
  const t = tangentRuns(R, rr, F, rf);
  // build a closed polyline: rear sprocket arc (back side) -> run -> front arc -> run
  const pts = [];
  const arc = (c, r, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(v3(c.x + r * Math.cos(a), c.y + r * Math.sin(a), 0));
    }
  };
  // t.up is measured from R towards F; the upper run touches R at angle t.up
  let aRupper = t.up;
  let aRlower = t.dn;
  // rear arc goes from lower tangent around the back to the upper tangent
  let a0 = aRlower;
  let a1 = aRupper;
  while (a1 < a0) a1 += Math.PI * 2;
  // we want the arc around the rear (angles near PI); choose the long way if needed
  const midA = (a0 + a1) / 2;
  if (Math.cos(midA) > 0) a1 -= Math.PI * 2;
  arc(R, rr, a0, a1, 40);
  // upper run to front sprocket
  const fu = t.upper[1];
  const fl = t.lower[1];
  const aFu = Math.atan2(fu.y - F.y, fu.x - F.x);
  let aFl = Math.atan2(fl.y - F.y, fl.x - F.x);
  // front arc from upper tangent forward around to lower tangent (clockwise around the front)
  let b0 = aFu;
  let b1 = aFl;
  while (b1 > b0) b1 -= Math.PI * 2;
  if (Math.cos((b0 + b1) / 2) < 0) b1 += Math.PI * 2;
  arc(F, rf, b0, b1, 16);
  pts.push(pts[0].clone());
  // resample by pitch
  const pitch = 0.015875;
  const seg = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = pts[i].distanceTo(pts[i + 1]);
    seg.push(l);
    total += l;
  }
  const n = Math.round(total / pitch);
  const step = total / n;
  const at = (dist) => {
    let d = dist;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i]) {
        const p = pts[i].clone().lerp(pts[i + 1], d / seg[i]);
        const dir = pts[i + 1].clone().sub(pts[i]).normalize();
        return { p, dir };
      }
      d -= seg[i];
    }
    return { p: pts[0].clone(), dir: v3(1, 0, 0) };
  };
  const plates = [];
  const rollers = [];
  for (let i = 0; i < n; i++) {
    const { p, dir } = at(i * step + step / 2);
    const ang = Math.atan2(dir.y, dir.x);
    const outer = i % 2 === 0;
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(step * 1.22, outer ? 0.0118 : 0.011, 0.0016);
      g.rotateZ(ang);
      g.translate(p.x, p.y, CHAIN_Z + s * (outer ? 0.0095 : 0.0072));
      plates.push(g);
    }
    const r = at(i * step);
    rollers.push(place(cyl(0.0051, 0.0051, 0.016, 6, true), { r: [Math.PI / 2, 0, 0], p: [r.p.x, r.p.y, CHAIN_Z] }));
  }
  grp.add(mesh(merge(plates), M.chain, 'ChainPlates'));
  grp.add(mesh(merge(rollers), M.steel, 'ChainRollers'));
  // front sprocket (15T)
  const teeth = 15;
  const sp = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const da = (Math.PI * 2) / teeth;
    sp.push([(rf - 0.006) * Math.cos(a0), (rf - 0.006) * Math.sin(a0)]);
    sp.push([(rf + 0.003) * Math.cos(a0 + da * 0.35), (rf + 0.003) * Math.sin(a0 + da * 0.35)]);
    sp.push([(rf + 0.003) * Math.cos(a0 + da * 0.6), (rf + 0.003) * Math.sin(a0 + da * 0.6)]);
    sp.push([(rf - 0.006) * Math.cos(a0 + da * 0.9), (rf - 0.006) * Math.sin(a0 + da * 0.9)]);
  }
  grp.add(mesh(extrude(shape(sp), 0.007, 0.0005, 1, 3).translate(F.x, F.y, CHAIN_Z), M.sprocket, 'FrontSprocket'));
  return grp;
}

export function buildRearShock(M) {
  const grp = new THREE.Group();
  grp.name = 'RearShock';
  const top = v3(-0.115, 0.6, 0);
  const bot = v3(-0.205, 0.37, 0);
  const dir = bot.clone().sub(top).normalize();
  grp.add(mesh(merge([rod(top, top.clone().addScaledVector(dir, 0.12), 0.023, 20), rod(top.clone().addScaledVector(dir, 0.1), bot, 0.008, 12)]), M.engineDark, 'ShockBody'));
  // spring coil
  const coil = [];
  const turns = 7;
  const L = top.distanceTo(bot) - 0.05;
  const q = new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), dir);
  for (let i = 0; i <= turns * 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const h = 0.03 + (L - 0.04) * (i / (turns * 24));
    coil.push(v3(0.031 * Math.cos(a), h, 0.031 * Math.sin(a)).applyQuaternion(q).add(top));
  }
  grp.add(mesh(tube(coil, 0.0048, turns * 24, 8), M.engineDark, 'ShockSpring'));
  // linkage plates
  const link = [];
  link.push(beam(v3(-0.205, 0.37, 0.03), v3(-0.16, 0.31, 0.03), 0.01, 0.03));
  link.push(beam(v3(-0.205, 0.37, -0.03), v3(-0.16, 0.31, -0.03), 0.01, 0.03));
  link.push(beam(v3(-0.16, 0.31, 0), v3(-0.15, 0.36, 0), 0.05, 0.025));
  grp.add(mesh(merge(link), M.frame, 'Linkage'));
  return grp;
}

export function buildFootControls(M) {
  const grp = new THREE.Group();
  grp.name = 'FootControls';
  const alu = [];
  const black = [];
  const rub = [];
  for (const s of [-1, 1]) {
    const z = s * 0.158;
    // rider peg bracket with heel guard (machined aluminium)
    const sh = (pts) => pts.map(([x, y]) => [x - 0.055, y + 0.02]);
    const outline = sh([[-0.128, 0.505], [-0.165, 0.515], [-0.315, 0.47], [-0.33, 0.44], [-0.3, 0.41], [-0.215, 0.36], [-0.17, 0.35], [-0.135, 0.39]]);
    const holes = [
      sh([[-0.2, 0.455], [-0.255, 0.44], [-0.21, 0.42]]),
      sh([[-0.27, 0.452], [-0.3, 0.442], [-0.275, 0.428]]),
      sh([[-0.16, 0.47], [-0.19, 0.462], [-0.165, 0.44]]),
    ];
    alu.push(plate(outline, z, 0.01, holes, 0.0015));
    // footpeg
    const pegA = v3(-0.245, 0.39, z + s * 0.005);
    const pegB = v3(-0.255, 0.388, z + s * 0.085);
    alu.push(rod(pegA, pegB, 0.011, 14));
    rub.push(rod(pegA.clone().lerp(pegB, 0.35), pegB, 0.0125, 14));
    // lever: brake pedal (right) / gear lever (left), pivot at the peg
    const tip = v3(-0.13, s > 0 ? 0.355 : 0.42, z + s * 0.03);
    alu.push(sweep([v3(-0.245, 0.39, z + s * 0.012), v3(-0.195, 0.375, z + s * 0.018), tip], () => rrect(0.012, 0.01, 0.003, 2), { steps: 12, up: v3(0, 0, 1) }));
    alu.push(rod(tip, tip.clone().add(v3(0, 0, s * 0.045)), 0.008, 10));
  }
  // gear-change linkage rod (left)
  black.push(rod(v3(-0.15, 0.42, -0.172), v3(-0.08, 0.47, -0.175), 0.004, 8));
  // side stand (left, folded)
  black.push(sweep([v3(-0.06, 0.22, -0.145), v3(-0.2, 0.235, -0.165), v3(-0.34, 0.255, -0.17)], (t) => rrect(0.02, 0.016, 0.005, 2), { steps: 10, up: UP }));
  black.push(place(rbox(0.05, 0.012, 0.035, 0.004), { p: [-0.35, 0.252, -0.17] }));
  grp.add(mesh(merge(alu), M.alu, 'Rearsets'));
  grp.add(mesh(merge(rub), M.rubber, 'PegRubbers'));
  grp.add(mesh(merge(black), M.frame, 'SideStand'));
  return grp;
}

export { beam, plate };

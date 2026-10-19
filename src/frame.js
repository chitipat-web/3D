// Frame, sub-frame, swing-arm, rear suspension, chain, foot controls.
import * as THREE from 'three';
import { DEG, kf, clamp, sweep, rrect, circle, shape, circlePts, extrude, rbox, cyl, rod, tube, place, merge, latheZ, loft, mirrorZ, flipGeometry } from './geom.js';
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

// Box-section arm built from constant-x cross-sections: rounded rectangles in
// the z-y plane spanning bot(x)..top(x) and zIn(x)..zOut(x). dent(x, y) pushes
// the outer face in (cast scallops). Right side; mirror for the left.
function sectionArm(xs, { top, bot, zIn, zOut, r = 0.012, dent = null, nFace = 10 }) {
  const rings = xs.map((x) => {
    const y0 = bot(x);
    const y1 = top(x);
    const z0 = zIn(x);
    const z1 = zOut(x);
    const rr = Math.min(r, (y1 - y0) * 0.45, (z1 - z0) * 0.45);
    const ring = [];
    const arc = (cz, cy, a0) => {
      for (let k = 1; k < 4; k++) {
        const a = a0 + (k / 4) * (Math.PI / 2);
        ring.push([x, cy + rr * Math.sin(a), cz + rr * Math.cos(a)]);
      }
    };
    for (let k = 0; k <= nFace; k++) {
      const y = y0 + rr + ((y1 - y0 - 2 * rr) * k) / nFace;
      ring.push([x, y, z1 - (dent ? dent(x, y) : 0)]);
    }
    arc(z1 - rr, y1 - rr, 0);
    ring.push([x, y1, z1 - rr], [x, y1 + 0.002, (z0 + z1) / 2], [x, y1, z0 + rr]);
    arc(z0 + rr, y1 - rr, Math.PI / 2);
    for (let k = 0; k <= 3; k++) ring.push([x, y1 - rr - ((y1 - y0 - 2 * rr) * k) / 3, z0]);
    arc(z0 + rr, y0 + rr, Math.PI);
    ring.push([x, y0, z0 + rr], [x, y0 - 0.002, (z0 + z1) / 2], [x, y0, z1 - rr]);
    arc(z1 - rr, y0 + rr, (3 * Math.PI) / 2);
    return ring;
  });
  let g = loft(rings, { closed: true, su: 1, sv: 2 });
  // outward-facing skin: the outer-face normal must point to +z
  const mid = Math.floor(rings.length / 2) * 2 * rings[0].length + 5;
  if (g.attributes.normal.getZ(mid) < 0) g = flipGeometry(g);
  const cap = (ring, dir) => {
    const c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length, a[2] + p[2] / ring.length], [0, 0, 0]);
    const pos = [...c];
    ring.forEach((p) => pos.push(...p));
    const idx = [];
    for (let k = 0; k < ring.length; k++) idx.push(0, 1 + k, 1 + ((k + 1) % ring.length));
    let cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
    cg.setIndex(idx);
    cg.computeVertexNormals();
    if (cg.attributes.normal.getX(0) * dir < 0) cg = flipGeometry(cg);
    return cg;
  };
  return merge([g, cap(rings[0], 1), cap(rings[rings.length - 1], -1)]);
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
    // (traced from the naked-chassis photo: top edge (0.34, 0.86) to
    // (-0.1, 0.68), lower edge (0.3, 0.725) to (0.0, 0.625))
    const path = [
      v3(0.445, 0.8, s * 0.03),
      v3(0.39, 0.797, s * 0.085),
      v3(0.3, 0.785, s * 0.135),
      v3(0.16, 0.737, s * 0.152),
      v3(0.02, 0.683, s * 0.152),
      v3(-0.085, 0.642, s * 0.142),
      v3(-0.13, 0.615, s * 0.132),
    ];
    parts.push(
      sweep(path, (t) => rrect(THREE.MathUtils.lerp(0.135, 0.09, t), THREE.MathUtils.lerp(0.05, 0.042, t), 0.012, 3), {
        steps: 40,
        up: UP,
      })
    );
    // pivot section: vertical member down past the swing-arm pivot
    // (v16: re-traced from both side photos: 8-9 cm deep, from x -0.20 to
    // -0.12, with the engine showing in front of it; the gusset above
    // joins it to the spar)
    parts.push(
      sweep([v3(-0.16, 0.7, s * 0.13), v3(-0.16, 0.56, s * 0.13), v3(-0.157, 0.44, s * 0.13), v3(-0.152, 0.335, s * 0.128)], (t) =>
        rrect(THREE.MathUtils.lerp(0.085, 0.095, t), 0.044, 0.014, 3), { steps: 24, up: v3(1, 0, 0) })
    );
    // sub-frame / shock mount boss at the top rear corner
    parts.push(place(rbox(0.05, 0.045, 0.044, 0.01), { p: [-0.18, 0.705, s * 0.13], r: [0, 0, 0.3] }));
    // cast gusset joining the spar's rear end to the pivot section, up to
    // the side cover (v16: both side photos show it solid from x -0.21 to
    // -0.05 below the side cover's silver line, with a big bolt at
    // (-0.18, 0.665); the naked-chassis photo agrees)
    parts.push(plate([[-0.214, 0.732], [-0.15, 0.75], [-0.09, 0.742], [-0.035, 0.72], [0.035, 0.69], [0.052, 0.6], [0.025, 0.586], [-0.05, 0.576], [-0.095, 0.567], [-0.118, 0.552], [-0.2, 0.6]], s * 0.141, 0.02, [], 0.004));

    // front engine hanger: cast plate under the spar down to the head mount,
    // just outside the cylinder head (v16: re-traced from the naked-chassis
    // photo; its front edge is the rear edge of the see-through gap behind
    // the radiator)
    parts.push(plate([[0.268, 0.555], [0.278, 0.578], [0.288, 0.6], [0.298, 0.62], [0.31, 0.64], [0.322, 0.66], [0.336, 0.674], [0.356, 0.688], [0.372, 0.718], [0.33, 0.738], [0.27, 0.724], [0.236, 0.672], [0.214, 0.62], [0.196, 0.565], [0.186, 0.528], [0.198, 0.506], [0.226, 0.51], [0.25, 0.53]], s * 0.158, 0.016, [], 0.003));

    parts.push(beam(v3(-0.13, 0.42, s * 0.13), v3(-0.03, 0.28, s * 0.14), 0.022, 0.035));
    // dark hex socket in the polished swing-arm pivot cap (see FrameBolts)
    parts.push(place(cyl(0.0075, 0.0075, 0.004, 6), { r: [Math.PI / 2, 0, 0], p: [PIVOT.x, PIVOT.y, s * 0.1675] }));
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
    sub.push(sweep([v3(-0.17, 0.668, s * 0.12), v3(-0.33, 0.68, s * 0.118), v3(-0.45, 0.745, s * 0.1), v3(-0.56, 0.808, s * 0.085)], (t) => rrect(0.026, 0.022, 0.006, 2), {
      steps: 18,
      up: UP,
    }));
  }
  sub.push(place(rbox(0.03, 0.025, 0.15, 0.006), { p: [-0.6, 0.866, 0] }));
  sub.push(place(rbox(0.03, 0.025, 0.12, 0.006), { p: [-0.74, 0.93, 0] }));
  grp.add(mesh(merge(sub), M.frame, 'SubFrame'));

  // pillion peg hangers (cast, black) with triangular openings
  const hangers = [];
  // (traced: bolts at (-0.329, 0.678) and (-0.407, 0.732), peg at (-0.575, 0.59))
  for (const s of [-1, 1]) {
    const outline = [
      [-0.314, 0.678], [-0.322, 0.694], [-0.395, 0.748], [-0.41, 0.751], [-0.423, 0.741], [-0.432, 0.727], [-0.578, 0.608],
      [-0.594, 0.598], [-0.594, 0.578], [-0.576, 0.567], [-0.555, 0.573], [-0.34, 0.66], [-0.322, 0.664],
    ];
    const hole = [[-0.352, 0.684], [-0.528, 0.602], [-0.397, 0.715]];
    hangers.push(plate(outline, s * 0.136, 0.012, [hole], 0.002));
  }
  grp.add(mesh(merge(hangers), M.frame, 'PillionHangers'));
  // pillion pegs, folded up
  const ppegs = [];
  const pegBase = [];
  for (const s of [-1, 1]) {
    ppegs.push(rod(v3(-0.574, 0.61, s * 0.152), v3(-0.591, 0.686, s * 0.156), 0.011, 12));
    pegBase.push(place(rbox(0.03, 0.03, 0.022, 0.005), { p: [-0.578, 0.592, s * 0.15] }));
  }
  grp.add(mesh(merge(ppegs), M.rubber, 'PillionPegs'));
  grp.add(mesh(merge(pegBase), M.alu, 'PillionPegMounts'));

  // black inner fender / battery box under the seat, between the sub-frame
  // rails (v16: kept up behind the seat side covers; both side photos show
  // daylight below the sub-frame, above the swing-arm)
  grp.add(
    mesh(
      extrude(shape([[-0.165, 0.775], [-0.38, 0.792], [-0.408, 0.765], [-0.404, 0.722], [-0.33, 0.705], [-0.22, 0.703], [-0.165, 0.708]]), 0.17, 0.01, 2, 4),
      M.plastic,
      'InnerFender'
    )
  );
  // frame bolts seen in the side photos, all bright: the big bolt in the
  // gusset, the lower pivot boss, the sub-frame / hanger bolt, the gusset's
  // front bolt and the front engine mount bolt; and the polished swing-arm
  // pivot caps (a round cap with a hex socket, 3/4 photo)
  const bolts = [];
  for (const s of [-1, 1]) {
    for (const [x, y, z, r] of [[-0.181, 0.666, 0.155, 0.0115], [-0.198, 0.585, 0.153, 0.0105], [-0.31, 0.674, 0.144, 0.0105], [0.032, 0.605, 0.153, 0.009], [0.2, 0.522, 0.168, 0.012]]) {
      bolts.push(place(cyl(r, r, 0.008, 18), { r: [Math.PI / 2, 0, 0], p: [x, y, s * z] }));
      bolts.push(place(cyl(r * 0.6, r * 0.6, 0.01, 6), { r: [Math.PI / 2, 0, 0], p: [x, y, s * (z + 0.002)] }));
    }
    bolts.push(place(cyl(0.0205, 0.0215, 0.009, 28), { r: [Math.PI / 2, 0, 0], p: [PIVOT.x, PIVOT.y, s * 0.1615] }));
  }
  grp.add(mesh(merge(bolts), M.bolt, 'FrameBolts'));
  return grp;
}

export function buildSwingarm(M) {
  const grp = new THREE.Group();
  grp.name = 'Swingarm';
  const parts = [];
  // Cast arms, side profile traced from the 2019 studio side photo: tall at
  // the front (about 20 cm) with a scooped outer face, tapering to the axle.
  // They sit inside the frame at the pivot and step out behind it.
  const arm = sectionArm(
    Array.from({ length: 27 }, (_, i) => -0.115 - (0.64 * i) / 26),
    {
      top: kf([[-0.115, 0.462], [-0.15, 0.496], [-0.2, 0.536], [-0.26, 0.566], [-0.32, 0.58], [-0.38, 0.581], [-0.44, 0.566], [-0.5, 0.538], [-0.56, 0.5], [-0.625, 0.448], [-0.68, 0.4], [-0.725, 0.362], [-0.755, 0.338]]),
      bot: kf([[-0.115, 0.398], [-0.16, 0.388], [-0.22, 0.377], [-0.32, 0.36], [-0.42, 0.344], [-0.52, 0.327], [-0.62, 0.307], [-0.7, 0.29], [-0.755, 0.288]]),
      zIn: kf([[-0.115, 0.07], [-0.2, 0.078], [-0.27, 0.108], [-0.34, 0.112], [-0.755, 0.112]]),
      zOut: kf([[-0.115, 0.104], [-0.2, 0.107], [-0.27, 0.146], [-0.34, 0.151], [-0.6, 0.15], [-0.755, 0.146]]),
      r: 0.014,
      dent: (x, y) => {
        const e = ((x + 0.39) / 0.08) ** 2 + ((y - 0.462) / 0.048) ** 2;
        return e < 1 ? 0.011 * Math.pow(1 - e, 0.6) : 0;
      },
    }
  );
  parts.push(arm, mirrorZ(arm));
  // pivot tube
  parts.push(place(cyl(0.034, 0.034, 0.2, 24), { r: [Math.PI / 2, 0, 0], p: [PIVOT.x, PIVOT.y, 0] }));
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
  // chain guard: a blade over the upper run as it reaches the sprocket (left),
  // standing clear above the arm (traced from the side photo)
  {
    const yt = kf([[-0.5, 0.51], [-0.6, 0.492], [-0.7, 0.468], [-0.79, 0.445]]);
    const rings = [];
    for (let i = 0; i <= 10; i++) {
      const x = -0.5 - (0.29 * i) / 10;
      const y = yt(x);
      const h = THREE.MathUtils.lerp(0.032, 0.022, i / 10);
      rings.push([[x, y - 0.006, -0.088], [x, y, -0.096], [x, y + 0.002, -0.11], [x, y, -0.122], [x, y - h, -0.126]]);
    }
    grp.add(mesh(loft(rings, { su: 2, sv: 2 }), M.plastic, 'ChainGuard'));
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
  const hang = [];
  // (v14, re-traced from both side photos and checked through the 3/4
  // photos: the slanted heel plate sits higher and further back than
  // before, and the peg pivots 4.5 cm further back under its lower tip)
  for (const s of [-1, 1]) {
    const z = s * 0.158;
    // machined heel plate with three slots
    const outline = [[-0.375, 0.548], [-0.335, 0.551], [-0.31, 0.536], [-0.27, 0.501], [-0.236, 0.471], [-0.222, 0.452], [-0.234, 0.434], [-0.258, 0.418], [-0.281, 0.424], [-0.302, 0.441], [-0.33, 0.47], [-0.356, 0.5], [-0.378, 0.528]];
    const slot = (x0, y0, x1, y1, w) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const l = Math.hypot(dx, dy);
      const nx = (-dy / l) * w;
      const ny = (dx / l) * w;
      return [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
    };
    const holes = [slot(-0.362, 0.528, -0.338, 0.516, 0.0035), slot(-0.334, 0.505, -0.312, 0.494, 0.0035), slot(-0.321, 0.522, -0.302, 0.512, 0.0035)];
    alu.push(plate(outline, z, 0.01, holes, 0.0015));
    // dark cast hanger from the plate's lower tip down to the peg pivot
    hang.push(plate([[-0.247, 0.432], [-0.27, 0.426], [-0.309, 0.398], [-0.309, 0.378], [-0.288, 0.376], [-0.25, 0.408]], z - s * 0.004, 0.012, [], 0.002));
    // footpeg (straight out, a touch swept back)
    const pegA = v3(-0.296, 0.389, z + s * 0.005);
    const pegB = v3(-0.312, 0.387, z + s * 0.085);
    alu.push(rod(pegA, pegB, 0.011, 14));
    rub.push(rod(pegA.clone().lerp(pegB, 0.35), pegB, 0.0125, 14));
    // brake pedal (right) / gear lever (left), pivoting at the peg and
    // reaching forward and down to the toe pad
    const tip = v3(s > 0 ? -0.19 : -0.176, s > 0 ? 0.305 : 0.322, z + s * 0.03);
    alu.push(sweep([v3(-0.296, 0.389, z + s * 0.012), v3(-0.245, 0.356, z + s * 0.018), tip], () => rrect(0.012, 0.01, 0.003, 2), { steps: 12, up: v3(0, 0, 1) }));
    alu.push(rod(tip, tip.clone().add(v3(0, 0, s * 0.045)), 0.008, 10));
  }
  // rear brake fluid reservoir on the right (v17: right-side and 3/4
  // photos): a pale translucent cup in front of the frame's pivot section,
  // above the crankcase, on a black bracket, with a black cap; its hose runs
  // down and back to the master cylinder behind the brake pedal
  const cup = [];
  cup.push(place(rbox(0.044, 0.03, 0.024, 0.006), { p: [-0.082, 0.527, 0.15] }));
  black.push(place(rbox(0.03, 0.007, 0.02, 0.003), { p: [-0.086, 0.545, 0.15] }));
  black.push(place(rbox(0.012, 0.036, 0.006, 0.002), { p: [-0.108, 0.53, 0.137] }));
  // (the hose drops inside the frame's pivot section, out of sight)
  black.push(tube([v3(-0.072, 0.512, 0.145), v3(-0.1, 0.475, 0.1), v3(-0.2, 0.405, 0.098), v3(-0.245, 0.375, 0.13), v3(-0.255, 0.367, 0.148)], 0.0042, 24, 8));
  black.push(place(cyl(0.011, 0.011, 0.05, 12), { r: [0, 0, 1.1], p: [-0.262, 0.362, 0.152] }));
  // gear-change linkage rod (left): from the lever up to the shift arm
  black.push(rod(v3(-0.232, 0.348, -0.182), v3(-0.095, 0.418, -0.178), 0.004, 8));
  black.push(place(cyl(0.008, 0.008, 0.012, 12), { r: [Math.PI / 2, 0, 0], p: [-0.095, 0.418, -0.176] }));
  // side stand (left, folded): pivot bolt under the engine at x -0.14, the
  // leg tucked up level with the chain's lower run (left photo)
  black.push(sweep([v3(-0.143, 0.266, -0.15), v3(-0.27, 0.274, -0.165), v3(-0.385, 0.281, -0.17)], (t) => rrect(0.02, 0.016, 0.005, 2), { steps: 10, up: UP }));
  black.push(place(rbox(0.05, 0.012, 0.035, 0.004), { p: [-0.395, 0.279, -0.17] }));
  black.push(place(cyl(0.017, 0.017, 0.03, 16), { r: [Math.PI / 2, 0, 0], p: [-0.143, 0.268, -0.145] }));
  grp.add(mesh(merge(alu), M.alu, 'Rearsets'));
  grp.add(mesh(merge(rub), M.rubber, 'PegRubbers'));
  grp.add(mesh(merge(cup), M.fluidCup, 'RearReservoir'));
  grp.add(mesh(merge(hang), M.aluDark, 'RearsetHangers'));
  grp.add(mesh(merge(black), M.frame, 'SideStand'));
  return grp;
}

export { beam, plate };

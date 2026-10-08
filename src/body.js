// Bodywork — traced from the official 2019 ZX-6R (ZX636G) studio photos.
//
// Side fairings are separate moulded panels (side view outlines lifted onto a
// lateral hull), the nose is built from front-facing panels (front view
// outlines lifted onto a forward hull), and the tank, seats and tail are lofts
// along the bike. All coordinates are metres: +X forward, +Y up, +Z right.
import * as THREE from 'three';
import { DEG, kf, loft, mirrorRing, mirrorCreases, mirrorZ, merge, sweep, rrect, rbox, cyl, rod, tube, place, lerp, clamp, smooth } from './geom.js';
import { buildPanel, tableSurface, splitByZ } from './panel.js';
import { FA, PF, forkAt } from './layout.js';
import { mesh } from './chassis.js';
import { sideUV, frontUV } from './livery.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { createGauge } from './gauge.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const C = 1; // corner flag for outline points

// Front panels are built in (u, v, w) = (-z, y, x); this maps them to bike space.
const FRONT_FRAME = new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);
const toFront = (g) => g.applyMatrix4(FRONT_FRAME);
// outline in (z, y) -> (u, v)
const zy = (pts) => pts.map((p) => [-p[0], p[1], p[2] || 0]);

// ===========================================================================
// Lateral hull of the fairing (half width at side-view point x, y)
// ===========================================================================
const A_MAX = kf([[0.8, 0.232], [0.72, 0.25], [0.62, 0.257], [0.5, 0.255], [0.4, 0.25], [0.3, 0.243], [0.2, 0.233], [0.1, 0.222], [0.0, 0.211], [-0.12, 0.198]]);
const Y_MAX = kf([[0.8, 0.77], [0.62, 0.735], [0.45, 0.68], [0.25, 0.615], [0.0, 0.585], [-0.12, 0.575]]);
export function sideW(x, y) {
  const a = A_MAX(x);
  const ym = Y_MAX(x);
  let b;
  if (y >= ym) {
    const t = clamp((y - ym) / (0.97 - ym), 0, 1.3);
    b = 1 - 0.42 * t * t;
  } else {
    const t = clamp((ym - y) / (ym - 0.15), 0, 1.3);
    b = 1 - 0.42 * Math.pow(t, 1.7);
  }
  return a * b;
}

// line helper: y on the segment A-B at x
const lineY = (A, B) => (x) => A[1] + ((B[1] - A[1]) * (x - A[0])) / (B[0] - A[0]);
// rounded "max(0, t)" so creases read as crisp but smoothly shaded character lines
const soft = (t, k = 0.006) => (t > 8 * k ? t : k * Math.log1p(Math.exp(t / k)));

// ===========================================================================
// Side panels (right side; mirrored for the left)
// ===========================================================================
// The side lines below were traced from the black 2020 bike and the KRT
// studio photos, each mapped onto the model through its solved camera.
//
// P1: upper side cowl. Its lower edge is the seam over the "Ninja" panel in
// front and the top of the radiator vent behind; the two meet in a pointed
// fin. Behind the fin a narrow chamfer (C1 to U) faces up and runs on back
// over the side cover; in front of it the lip over the seam flares out a
// little up to the character line U, above which the skin turns in.
const FIN = [0.497, 0.729];
const P1_C1 = [[0.12, 0.662], [0.25, 0.69], [0.33, 0.709], [0.42, 0.723], FIN];
const P1_U = [[0.12, 0.692], [0.25, 0.721], [0.33, 0.741], [0.42, 0.747], [0.51, 0.755], [0.584, 0.767], [0.657, 0.775], [0.74, 0.781]];
// P1's lower edge from just behind the fin forward (seam over the Ninja panel)
const P1_SEAM = [[0.4, 0.712], [0.45, 0.722], FIN, [0.513, 0.734], [0.589, 0.746], [0.661, 0.756], [0.733, 0.762]];
const c1Y = kf(P1_C1);
const uY = kf(P1_U);
const seamY = kf(P1_SEAM);
const chamferA = kf([[0.0, 0], [0.22, 0.6], [0.44, 0.65], [FIN[0] + 0.012, 0]]);
const flareA = kf([[0.47, 0], [0.53, 0.3]]);
const topA = kf([[0.38, 0.16], [0.52, 0.45], [0.74, 0.34]]);
// shared by the side cover, which carries the chamfer on towards the tank
const chamfer = (x, y) => chamferA(x) * (soft(y - c1Y(x), 0.005) - soft(y - uY(x), 0.005));
const p1Surface = (x, y) => {
  const u = uY(x);
  const lip = flareA(x) * (soft(u - y, 0.003) - soft(seamY(x) - y, 0.003));
  const top = topA(x) * 0.07 * Math.tanh(soft(y - u, 0.003) / 0.07);
  return sideW(x, y) + 0.004 - chamfer(x, y) - lip - top;
};
const P1 = {
  outline: [
    [0.744, 0.918, C], [0.738, 0.866], [0.727, 0.838, C], [0.726, 0.8], [0.729, 0.776], [0.733, 0.762, C],
    [0.661, 0.756], [0.589, 0.746], [0.513, 0.734], [FIN[0], FIN[1], C],
    [0.45, 0.722], [0.405, 0.712], [0.36, 0.698], [0.316, 0.68], [0.245, 0.636, C],
    [0.27, 0.68], [0.305, 0.74], [0.338, 0.796, C], [0.42, 0.815], [0.5, 0.84], [0.56, 0.874], [0.6, 0.922], [0.628, 0.962, C],
    [0.69, 0.943],
  ],
  surface: p1Surface,
  creases: [P1_C1.filter((p) => p[0] >= 0.25), P1_U.filter((p) => p[0] >= 0.25)],
};
// P2: the main side cowl under P1 (one moulding from the headlight down to
// the lower fairing: the "Ninja" script on top, the stripes below). Its rear
// edge runs down from the fin as the front of the vent; along the seam it
// tucks in under P1's lip.
const P2 = {
  outline: [
    [0.736, 0.772, C], [0.733, 0.75], [0.738, 0.714, C], [0.704, 0.678], [0.666, 0.656],
    [0.592, 0.62], [0.524, 0.56], [0.474, 0.494], [0.446, 0.436], [0.41, 0.37, C],
    [0.33, 0.386], [0.27, 0.4, C], [0.275, 0.46], [0.283, 0.508], [0.309, 0.558], [0.36, 0.619], [0.405, 0.663], [0.444, 0.7], [0.475, 0.714], [0.492, 0.722, C],
    [0.503, 0.737], [0.52, 0.745], [0.59, 0.757], [0.66, 0.767],
  ],
  surface: (x, y) => sideW(x, y) - 0.004 - 0.6 * soft(y - (seamY(x) - 0.012), 0.003),
};
// P3: side cover under the tank
// (traced: its lower edge runs from the bolt by the engine up along the
// silver line to the seat nose, leaving the frame spar visible below)
const P3 = {
  outline: [
    [0.336, 0.862, C], [0.25, 0.851], [0.15, 0.839], [0.05, 0.829], [0.0, 0.823], [-0.05, 0.811], [-0.1, 0.794], [-0.135, 0.779], [-0.162, 0.764, C],
    [-0.174, 0.744, C], [-0.12, 0.73], [-0.06, 0.714], [-0.04, 0.708, C], [0.0, 0.67], [0.03, 0.628], [0.048, 0.606, C],
    [0.1, 0.604], [0.16, 0.614], [0.24, 0.64], [0.298, 0.672, C], [0.322, 0.74], [0.336, 0.8],
  ],
  surface: (x, y) => sideW(x, y) - 0.002 - 0.15 * soft(y - 0.79) - chamfer(x, y),
  creases: [P1_C1.filter((p) => p[0] <= 0.34), P1_U.filter((p) => p[0] <= 0.34)],
};
// P3B: satin black cover under the rider's seat, from the side cover back to
// the tail (traced), tucked just inside P3's rear edge
const P3B = {
  outline: [
    [-0.104, 0.79, C], [-0.16, 0.777], [-0.2, 0.768], [-0.26, 0.762], [-0.312, 0.764, C], [-0.322, 0.725], [-0.306, 0.68, C],
    [-0.25, 0.652], [-0.17, 0.638], [-0.13, 0.64, C], [-0.108, 0.664], [-0.096, 0.73],
  ],
  surface: (x, y) => sideW(x, y) - 0.008 - 0.15 * soft(y - 0.79),
};
// P4: lower fairing, crease along its lower third tucks under towards the belly
const P4_CREASE = [[0.4, 0.27], [-0.08, 0.262]];
const p4CreaseY = lineY(...P4_CREASE);
const P4 = {
  outline: [
    [0.426, 0.376, C], [0.35, 0.376], [0.27, 0.386], [0.2, 0.37], [0.12, 0.352], [0.03, 0.346], [-0.04, 0.35, C], [-0.078, 0.3], [-0.086, 0.24, C],
    [-0.04, 0.196], [0.05, 0.179], [0.2, 0.172], [0.3, 0.172], [0.37, 0.178, C], [0.395, 0.22], [0.41, 0.28], [0.422, 0.33],
  ],
  surface: (x, y) => sideW(x, y) + 0.014 - 0.45 * soft(p4CreaseY(x) - y),
  creases: [P4_CREASE],
};
// inner cover around the steering head (matte black), kept inside P1
const innerZ = (x, y) => 0.12 + 0.11 * clamp((x - 0.33) / 0.35, 0, 1) - 0.25 * Math.max(0, y - 0.84);
const INNER = {
  outline: [[0.66, 0.9, C], [0.56, 0.885], [0.46, 0.874], [0.38, 0.87], [0.33, 0.87, C], [0.325, 0.8], [0.33, 0.78, C], [0.45, 0.8], [0.56, 0.83], [0.66, 0.86]],
  surface: (x, y) => {
    const a = innerZ(x, y);
    const b = p1Surface(x, y) - 0.01;
    return b - soft(b - a, 0.004);
  },
};

// matte black back wall of the vent between P1, P2 and the louvres (deeper
// at the rear so it stays behind the louvre plate)
const LINER = {
  outline: [[0.525, 0.752, C], [0.5, 0.68], [0.42, 0.58], [0.34, 0.5], [0.3, 0.455], [0.215, 0.47, C], [0.205, 0.63, C], [0.3, 0.7], [0.4, 0.74]],
  surface: (x, y) => sideW(x, y) - 0.034 - 0.03 * clamp((0.34 - x) / 0.06, 0, 1),
};

// green blade continuing the chin back along the side, under the "Ninja" panel
const CHIN_SIDE = {
  outline: [[0.79, 0.722, C], [0.74, 0.716], [0.7, 0.705], [0.672, 0.694, C], [0.69, 0.684], [0.74, 0.684], [0.79, 0.688, C]],
  surface: (x, y) => sideW(x, y) + 0.012,
};

function sidePanel(def, mat, matL, name, opts = {}) {
  const g = buildPanel({ outline: def.outline, holes: def.holes || [], surface: def.surface, creases: def.creases || [], uv: sideUV, roll: 0.006, flange: 0.006, spacing: 0.012, ...opts });
  const grp = new THREE.Group();
  grp.name = name;
  const r = mesh(g, mat, name + 'Right');
  const l = mesh(mirrorZ(g), matL || mat, name + 'Left');
  grp.add(r, l);
  return grp;
}

function bellyPan(M) {
  // joins the two lower fairings under the engine
  const xs = linspace(-0.08, 0.36, 14);
  const yb = kf([[-0.08, 0.235], [-0.04, 0.198], [0.05, 0.181], [0.2, 0.174], [0.3, 0.174], [0.36, 0.18]]);
  const rings = xs.map((x) => {
    const y = yb(x);
    const z = sideW(x, y) + 0.014 - 0.45 * soft(p4CreaseY(x) - y) - 0.004;
    return mirrorRing([[x, y - 0.03, 0], [x, y - 0.029, z * 0.5], [x, y - 0.02, z * 0.85], [x, y - 0.006, z * 0.98], [x, y + 0.004, z]]);
  });
  return mesh(loft(rings, { su: 3, sv: 2 }), M.plastic, 'BellyPan');
}

// ===========================================================================
// Nose: forward hull F(z, y) = x of the nose skin
// ===========================================================================
const NZ = [0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.27];
const NY = [0.7, 0.74, 0.77, 0.8, 0.83, 0.86, 0.89, 0.92, 0.95];
// traced from the calibrated side photo: beak tip (0.905, 0.77), screen base
// front (0.80, 0.895), lens from x 0.88 (inner) back to 0.735 (outer)
const NT = [
  //  z: 0     0.04   0.08   0.12   0.16   0.20   0.24   0.27
  [0.89, 0.884, 0.868, 0.842, 0.808, 0.772, 0.737, 0.705], // y 0.70
  [0.893, 0.887, 0.869, 0.841, 0.806, 0.77, 0.735, 0.702], // 0.74
  [0.905, 0.893, 0.868, 0.838, 0.802, 0.765, 0.73, 0.698], // 0.77
  [0.885, 0.876, 0.864, 0.838, 0.804, 0.766, 0.729, 0.695], // 0.80
  [0.868, 0.864, 0.86, 0.842, 0.81, 0.77, 0.73, 0.693], // 0.83  (fuller upper nose:
  [0.842, 0.84, 0.838, 0.824, 0.798, 0.764, 0.724, 0.688], // 0.86  side profile traced)
  [0.812, 0.81, 0.806, 0.796, 0.778, 0.754, 0.711, 0.678], // 0.89
  [0.79, 0.785, 0.778, 0.768, 0.752, 0.738, 0.7, 0.668], // 0.92
  [0.77, 0.765, 0.758, 0.748, 0.734, 0.72, 0.688, 0.656], // 0.95
];
const noseT = tableSurface(NZ, NY, NT);
export const noseF = (z, y) => noseT(Math.abs(z), y);
const frontSurface = (fn) => (u, v) => fn(-u, v);

// Face of the 2019 nose, front view (z outward, y up), right half. Traced
// from the studio close-ups: two green "V" arms frame a large black ram-air
// intake that runs up to the screen; each large angular headlight sits under
// an arm (pointed at the beak, ~9 cm tall at its outer end); a pointed green
// chin runs under both lights.
const LENS_R = [
  [0.046, 0.724, C], [0.08, 0.721], [0.12, 0.72], [0.16, 0.721], [0.188, 0.723, C], [0.212, 0.748], [0.229, 0.785], [0.239, 0.834, C],
  [0.215, 0.824], [0.18, 0.808], [0.14, 0.792], [0.1, 0.776], [0.07, 0.763], [0.046, 0.753, C],
];
const mirrorZY = (pts) => pts.map((p) => [-p[0], p[1], p[2] || 0]).reverse();
// pull an outline slightly towards its centre so walls built on it do not
// coincide with the lip of the panel around it
const shrinkOutline = (pts, k) => {
  const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
  return pts.map((p) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, p[2] || 0]);
};
const SCREEN_BASE = kf([[0, 0.894], [0.07, 0.896], [0.12, 0.9], [0.16, 0.906], [0.19, 0.914], [0.205, 0.92]]);
// right V arm, from the beak bottom round to the intake bottom centre
// green: V-arm band over the headlight, joined at the outer edge to a strip
// along the screen base that carries the mirror mounts
const ARM_R = [
  [0.03, 0.718], [0.046, 0.724, C], [0.044, 0.753, C],
  [0.07, 0.763], [0.1, 0.776], [0.14, 0.792], [0.18, 0.808], [0.215, 0.824], [0.239, 0.836, C],
  [0.247, 0.856], [0.245, 0.878], [0.238, 0.895], [0.215, 0.913, C],
  [0.19, 0.91], [0.165, 0.9065, C],
  [0.153, 0.878], [0.132, 0.851], [0.1, 0.828], [0.062, 0.8085], [0.036, 0.794, C],
];
// black wedge between the band and the upper cowl, opening into the deep
// ram-air duct in the middle that runs up to the screen
// (the intake reaches up to the screen base, its outer corner at z = 0.165)
const MASK_R = [
  [0.036, 0.794, C], [0.062, 0.8085], [0.1, 0.828], [0.132, 0.851], [0.153, 0.878], [0.165, 0.9065, C],
  [0.13, 0.9005], [0.1, 0.8985], [0.05, 0.8958],
];

function buildNose(M) {
  const grp = new THREE.Group();
  grp.name = 'Nose';
  // ---- upper cowl: the two V arms joined at the beak
  const n1 = [[0, 0.715, C], ...ARM_R, [0, 0.788, C], ...mirrorZY(ARM_R)];
  const g1 = toFront(
    buildPanel({ outline: zy(n1), surface: frontSurface(noseF), uv: frontUV, roll: 0.006, flange: 0.014, spacing: 0.009, edgeStep: 0.0035 })
  );
  grp.add(mesh(g1, M.decalFront, 'UpperCowl'));
  // ---- black mask above the arms: ram-air duct in the middle, trim at the sides
  {
    const outline = [[0, 0.8955], ...MASK_R.slice().reverse(), [0, 0.788, C], ...mirrorZY(MASK_R).reverse()];
    const depth = (z, y) => noseF(z, y) - lerp(0.024, 0.05, smooth(0.13, 0.07, Math.abs(z))) - 0.015 * smooth(0.83, 0.89, y) * smooth(0.13, 0.07, Math.abs(z));
    const floor = toFront(buildPanel({ outline: zy(outline), surface: frontSurface(depth), roll: 0, flange: 0, spacing: 0.01, edgeStep: 0.004 }));
    grp.add(mesh(floor, M.mesh, 'RamAirIntake'));
    // side walls from the cowl edge back to the floor
    const walls = toFront(
      buildPanel({ outline: zy(shrinkOutline(outline, 0.985)), surface: frontSurface((z, y) => noseF(z, y) - 0.012), roll: 0, flange: 0.045, spacing: 0.5, edgeStep: 0.004, cap: false })
    );
    grp.add(mesh(walls, M.plastic, 'IntakeDuct'));
  }
  // ---- black panel round the outer end of each headlight, from the lens
  // down to the chin and out to the side cowl
  {
    const NS = [
      [0.188, 0.721, C], [0.212, 0.746], [0.229, 0.784], [0.239, 0.834, C], [0.249, 0.84, C], [0.254, 0.8], [0.253, 0.75], [0.247, 0.712, C],
      [0.229, 0.724], [0.21, 0.72],
    ];
    for (const s of [1, -1]) {
      const g = toFront(buildPanel({ outline: zy(s > 0 ? NS : mirrorZY(NS)), surface: frontSurface((z, y) => noseF(z, y) - 0.0015), roll: 0.004, flange: 0.012, spacing: 0.006, edgeStep: 0.003 }));
      grp.add(mesh(g, M.body, s > 0 ? 'NoseSideRight' : 'NoseSideLeft'));
    }
  }
  // ---- headlights: lens, housing and internals
  for (const s of [1, -1]) {
    const outline = s > 0 ? LENS_R : mirrorZY(LENS_R);
    const lens = toFront(buildPanel({ outline: zy(outline), surface: frontSurface((z, y) => noseF(z, y) - 0.006), roll: 0, flange: 0, spacing: 0.009, edgeStep: 0.0035 }));
    const lm = mesh(lens, M.lens, 'HeadlightLens');
    lm.renderOrder = 3;
    grp.add(lm);
    // chrome reflector field recessed behind the lens
    const back = toFront(
      buildPanel({
        outline: zy(outline),
        surface: frontSurface((z, y) => noseF(z, y) - 0.05),
        roll: 0.004,
        flange: 0,
        spacing: 0.006,
        edgeStep: 0.0035,
        uv: (u, v) => [u / 0.04, v / 0.04],
      })
    );
    grp.add(mesh(back, M.headlightInner, 'HeadlightReflector'));
    // dark shell behind the reflector, so from the saddle the back of the
    // light reads as housing rather than chrome
    grp.add(mesh(back.clone().translate(-0.003, 0, 0), M.plastic, 'HeadlightBack'));
    const walls = toFront(
      buildPanel({ outline: zy(shrinkOutline(outline, 0.988)), surface: frontSurface((z, y) => noseF(z, y) - 0.006), roll: 0, flange: 0.044, spacing: 0.5, edgeStep: 0.0035, cap: false })
    );
    grp.add(mesh(walls, M.plastic, 'HeadlightHousing'));
    // LED projector modules: low beam (outer, large) and high beam (inner)
    const mods = [];
    const leds = [];
    for (const [zc, yc, r] of [[0.108, 0.746, 0.013], [0.176, 0.766, 0.019]]) {
      const z = s * zc;
      const x = noseF(zc, yc) - 0.034;
      const bowl = new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      bowl.rotateZ(-Math.PI / 2);
      bowl.translate(x - 0.006, yc, z);
      mods.push(bowl);
      const ring = new THREE.TorusGeometry(r * 0.86, r * 0.1, 8, 28);
      ring.rotateY(Math.PI / 2);
      ring.translate(x + 0.001, yc, z);
      mods.push(ring);
      const lensG = new THREE.CircleGeometry(r * 0.68, 28);
      lensG.rotateY(Math.PI / 2);
      lensG.translate(x + 0.002, yc, z);
      leds.push(lensG);
    }
    grp.add(mesh(merge(mods), M.chrome, 'LEDProjectors'));
    grp.add(mesh(merge(leds), M.led, 'LEDLowBeam'));
    // LED position light just under the top edge of the lens
    const drl = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const za = lerp(0.06, 0.226, t0);
      const zb = lerp(0.06, 0.226, t1);
      const ya = lerp(0.756, 0.826, t0) - 0.006;
      const yb = lerp(0.756, 0.826, t1) - 0.006;
      drl.push(rod(v3(noseF(za, ya) - 0.016, ya, s * za), v3(noseF(zb, yb) - 0.016, yb, s * zb), 0.0026, 6));
    }
    grp.add(mesh(merge(drl), M.led, 'PositionLight'));
  }
  // ---- pointed chin under both headlights
  const chinPlan = kf([[0, 0.896], [0.04, 0.89], [0.08, 0.877], [0.12, 0.857], [0.16, 0.829], [0.2, 0.794], [0.244, 0.752]]);
  const chinSurf = (z, y) => chinPlan(Math.abs(z)) - 0.35 * Math.max(0, 0.713 - y) - 0.1 * Math.max(0, y - 0.717);
  const chinTop = [[0.03, 0.717], [0.046, 0.723, C], [0.08, 0.72], [0.12, 0.719], [0.16, 0.72], [0.2, 0.723], [0.229, 0.729, C]];
  const chin = [
    [0, 0.685, C], [0.12, 0.688], [0.238, 0.695, C], [0.245, 0.709, C], ...chinTop.slice().reverse(), [0, 0.714, C],
    ...chinTop.map((p) => [-p[0], p[1], p[2] || 0]), [-0.245, 0.709, C], [-0.238, 0.695, C], [-0.12, 0.688],
  ];
  const gc = toFront(buildPanel({ outline: zy(chin), surface: frontSurface(chinSurf), roll: 0.006, flange: 0.02, spacing: 0.009, edgeStep: 0.0035 }));
  grp.add(mesh(gc, M.primary, 'ChinSpoiler'));
  // lower air duct around the radiator (black, under the chin)
  {
    const rings = linspace(0.66, 0.705, 3).map((y) => {
      const t = (y - 0.66) / 0.045;
      const hw = lerp(0.2, 0.235, t);
      const x = lerp(0.74, 0.865, t);
      return [[x - 0.1, y, -hw], [x - 0.02, y, -hw * 0.5], [x, y, 0], [x - 0.02, y, hw * 0.5], [x - 0.1, y, hw]];
    });
    grp.add(mesh(loft(rings, { su: 3, sv: 2 }), M.plastic, 'LowerDuct'));
  }
  return grp;
}

// ===========================================================================
// Windscreen
// ===========================================================================
function buildWindscreen(M) {
  const nT = 36;
  const nV = 16;
  // Traced from the 2019 side and 3/4 studio photos: the top edge arches
  // from the tip on the centre line (0.597, 1.105) down and back to corners
  // at (0.49, 1.02) that sit well behind the cowl tips, so the screen wraps
  // round the instruments; its rear edges stand free above the cowl tips.
  const ZT = 0.125;
  const topAt = (s) => {
    const z = ZT * Math.pow(Math.sin((s * Math.PI) / 2), 0.85);
    return { x: 0.597 - 0.107 * s * s, y: 1.105 - 0.085 * Math.pow(s, 2.2), z };
  };
  // u in [-1, 1] round the screen: |u| <= 0.62 front base on the nose, then
  // back along the upper side cowls to their tips
  const sOf = (a) => (a <= 0.62 ? (0.72 * a) / 0.62 : 0.72 + (0.28 * (a - 0.62)) / 0.38);
  const base = (u) => {
    const s = Math.abs(u);
    const sg = Math.sign(u) || 1;
    if (s <= 0.62) {
      const z = (0.19 * s) / 0.62;
      const y = SCREEN_BASE(z) + 0.002;
      return v3(noseF(z, y) + 0.003, y, sg * z);
    }
    const t = (s - 0.62) / 0.38;
    const x = lerp(0.744, 0.628, t);
    const y = lerp(0.922, 0.964, t) + 0.002;
    return v3(x, y, sg * (P1.surface(x, y) + 0.003));
  };
  const topPt = (u) => {
    const q = topAt(sOf(Math.abs(u)));
    return v3(q.x, q.y, (Math.sign(u) || 1) * q.z);
  };
  const rings = [];
  for (let j = 0; j <= nV; j++) {
    const v = j / nV;
    const ring = [];
    for (let i = 0; i <= nT; i++) {
      const u = -1 + (2 * i) / nT;
      const B = base(u);
      const T = topPt(u);
      const p = B.clone().lerp(T, v);
      // bubble: bulge out of the screen plane in the middle
      const amt = 0.016 * Math.sin(Math.PI * v) * (1 - 0.8 * u * u);
      p.x += amt * 0.48;
      p.y += amt * 0.82;
      p.z += amt * 0.6 * u;
      ring.push([p.x, p.y, p.z]);
    }
    rings.push(ring);
  }
  const g = loft(rings, { su: 2, sv: 2 });
  const grp = new THREE.Group();
  grp.name = 'Windscreen';
  const m = mesh(g, M.screen, 'ScreenGlass');
  m.renderOrder = 2;
  grp.add(m);
  return grp;
}

// ===========================================================================
// Tank
// ===========================================================================
export const TANK = {
  top: kf([[0.336, 0.872], [0.3, 0.906], [0.26, 0.938], [0.2, 0.963], [0.12, 0.981], [0.04, 0.989], [-0.03, 0.987], [-0.08, 0.974], [-0.11, 0.952], [-0.13, 0.912], [-0.142, 0.876]]),
  bot: kf([[0.336, 0.864], [0.25, 0.854], [0.15, 0.842], [0.05, 0.832], [0.0, 0.826], [-0.05, 0.814], [-0.1, 0.797], [-0.142, 0.785]]),
  w: kf([[0.336, 0.12], [0.3, 0.155], [0.24, 0.186], [0.16, 0.202], [0.08, 0.2], [0.0, 0.186], [-0.06, 0.164], [-0.1, 0.14], [-0.142, 0.1]]),
};
function tankRing(x) {
  const yt = TANK.top(x);
  const yb = TANK.bot(x);
  const w = TANK.w(x);
  const h = yt - yb;
  const knee = 0.07 * smooth(0.1, -0.04, x);
  const half = [
    [x, yt, 0],
    [x, yt - 0.004, 0.38 * w],
    [x, yt - 0.016, 0.68 * w],
    [x, yt - 0.034, 0.86 * w], // shoulder crease
    [x, yb + 0.55 * h, w * (1 - knee * 0.4)],
    [x, yb + 0.2 * h, 0.97 * w * (1 - knee)],
    [x, yb, 0.9 * w * (1 - knee)],
  ];
  return mirrorRing(half);
}
function buildTank(M, matR, matL) {
  const xs = linspace(0.336, -0.142, 24);
  const rings = xs.map(tankRing);
  const shr = (ring, k, dy) => {
    const c = ring.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / ring.length);
    return ring.map((p) => [p[0], c[1] + (p[1] - c[1]) * k + dy, p[2] * k]);
  };
  rings.unshift(shr(tankRing(0.343), 0.7, -0.004));
  rings.push(shr(tankRing(-0.149), 0.55, -0.006));
  const g = loft(rings, { su: 3, sv: 2, creaseCols: mirrorCreases([3], 7), uv: (p) => sideUV(p[0], p[1]) });
  const grp = new THREE.Group();
  grp.name = 'Tank';
  const [gr, gl] = splitByZ(g);
  const tR = mesh(gr, matR, 'FuelTankRight');
  const tL = mesh(gl, matL, 'FuelTankLeft');
  grp.add(tR, tL);
  // "Kawasaki" wordmark projected onto both upper flanks of the tank
  for (const [s, m] of [[1, tR], [-1, tL]]) {
    m.updateMatrixWorld(true);
    const x = 0.11;
    const y = TANK.top(x) - 0.028;
    const z = s * TANK.w(x) * 0.8;
    const n = new THREE.Vector3(0, 0.62, s).normalize();
    const look = new THREE.Object3D();
    look.position.set(x, y, z);
    look.lookAt(new THREE.Vector3(x, y, z).add(n));
    look.rotateZ(0.03);
    // projector x axis runs forward on the right and rearward on the left, so
    // the lettering reads left-to-right from either side
    const dg = new DecalGeometry(m, look.position, look.rotation, new THREE.Vector3(0.2, 0.0375, 0.12));
    const dm = mesh(dg, M.tankLogo, s > 0 ? 'TankLogoRight' : 'TankLogoLeft');
    dm.renderOrder = 1;
    grp.add(dm);
  }
  const yCap = TANK.top(0.1) + 0.0008;
  grp.add(mesh(place(cyl(0.041, 0.043, 0.005, 40), { p: [0.1, yCap, 0] }), M.alu, 'FuelCapRing'));
  grp.add(mesh(place(cyl(0.03, 0.032, 0.004, 40), { p: [0.1, yCap + 0.003, 0] }), M.plasticGloss, 'FuelCapLid'));
  return grp;
}

// ===========================================================================
// Seats, tail, undertray, plate holder, tail light
// ===========================================================================
const SEAT = {
  top: kf([[-0.118, 0.874], [-0.14, 0.857], [-0.18, 0.843], [-0.25, 0.836], [-0.32, 0.838], [-0.38, 0.85], [-0.43, 0.872], [-0.47, 0.895], [-0.505, 0.906]]),
  w: kf([[-0.118, 0.07], [-0.15, 0.105], [-0.22, 0.13], [-0.32, 0.134], [-0.42, 0.122], [-0.505, 0.1]]),
};
const PILLION = {
  top: kf([[-0.515, 0.912], [-0.545, 0.958], [-0.578, 0.99], [-0.62, 1.003], [-0.7, 1.013], [-0.78, 1.027], [-0.86, 1.042], [-0.876, 1.045]]),
  w: kf([[-0.515, 0.085], [-0.58, 0.094], [-0.66, 0.088], [-0.76, 0.072], [-0.876, 0.04]]),
};
const TAIL = {
  low: kf([[-0.3, 0.724], [-0.36, 0.724], [-0.42, 0.734], [-0.47, 0.752], [-0.51, 0.776], [-0.55, 0.8], [-0.6, 0.82], [-0.65, 0.843], [-0.7, 0.872], [-0.75, 0.905], [-0.8, 0.933], [-0.85, 0.956], [-0.876, 0.967]]),
  w: kf([[-0.28, 0.168], [-0.4, 0.161], [-0.5, 0.15], [-0.6, 0.13], [-0.7, 0.108], [-0.8, 0.084], [-0.876, 0.056]]),
};

function seatRing(x, S, thick, top = S.top(x)) {
  const w = S.w(x);
  const half = [[x, top, 0], [x, top - 0.002, 0.5 * w], [x, top - 0.01, 0.84 * w], [x, top - 0.028, w], [x, top - thick * 0.7, 0.97 * w], [x, top - thick, 0.9 * w]];
  return mirrorRing(half);
}
function capRings(rings, front, back) {
  const shr = (ring, k, dy) => {
    const c = ring.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / ring.length);
    return ring.map((p) => [p[0], c[1] + (p[1] - c[1]) * k + dy, p[2] * k]);
  };
  if (front) rings.unshift(shr(front[0], front[1], front[2]));
  if (back) rings.push(shr(back[0], back[1], back[2]));
  return rings;
}

function buildSeats(M) {
  const grp = new THREE.Group();
  grp.name = 'Seats';
  const rs = capRings(linspace(-0.118, -0.505, 18).map((x) => seatRing(x, SEAT, 0.07)), [seatRing(-0.111, SEAT, 0.07), 0.5, -0.012], [seatRing(-0.512, SEAT, 0.07), 0.7, -0.01]);
  grp.add(mesh(loft(rs, { su: 4, sv: 2 }), M.seat, 'RiderSeat'));
  const ps = capRings(linspace(-0.515, -0.872, 16).map((x) => seatRing(x, PILLION, 0.045)), [seatRing(-0.508, PILLION, 0.045), 0.6, -0.01], [seatRing(-0.878, PILLION, 0.045), 0.6, -0.004]);
  grp.add(mesh(loft(ps, { su: 4, sv: 2 }), M.seat, 'PillionSeat'));
  return grp;
}

function tailRing(x) {
  const yL = TAIL.low(x);
  const w = TAIL.w(x);
  // top edge tucks under the seats
  const seatTop = x > -0.512 ? SEAT.top(Math.max(-0.505, x)) - 0.05 : PILLION.top(Math.max(-0.876, x)) - 0.036;
  const yU = Math.max(seatTop, yL + 0.03);
  const h = yU - yL;
  const half = [
    [x, yU - 0.01, 0],
    [x, yU, 0.55 * w],
    [x, yU - 0.004, 0.86 * w],
    [x, yU - 0.2 * h, w],
    [x, yL + 0.35 * h, 0.97 * w],
    [x, yL + 0.06 * h, 0.86 * w],
    [x, yL, 0.7 * w],
  ];
  return mirrorRing(half);
}
function buildTail(M, matR, matL) {
  const xs = linspace(-0.27, -0.872, 26);
  const rings = xs.map(tailRing);
  const creases = mirrorCreases([3, 5], 7);
  const g = loft(rings, { creaseCols: creases, su: 3, sv: 2, uv: (p) => sideUV(p[0], p[1]) });
  // each half reads its own side texture (the left one has mirrored lettering)
  const grp = new THREE.Group();
  grp.name = 'TailCowl';
  const [gr, gl] = splitByZ(g);
  grp.add(mesh(gr, matR, 'TailCowlRight'), mesh(gl, matL, 'TailCowlLeft'));
  return grp;
}

function buildTailEnd(M) {
  const grp = new THREE.Group();
  grp.name = 'TailEnd';
  // undertray: closes the bottom of the tail cowl
  {
    const xs = linspace(-0.3, -0.84, 16);
    const rings = xs.map((x) => {
      const y = TAIL.low(x) + 0.004;
      const w = TAIL.w(x) * 0.7;
      return [[x, y + 0.006, -w], [x, y - 0.002, -w * 0.6], [x, y - 0.004, 0], [x, y - 0.002, w * 0.6], [x, y + 0.006, w]];
    });
    grp.add(mesh(loft(rings, { su: 3, sv: 2 }), M.plastic, 'Undertray'));
  }
  // tail light: a wide red lens tucked under the tail tip, its rear face
  // sloping forward-down (traced: x -0.80..-0.885, y 0.925..0.97)
  const xs = linspace(-0.795, -0.886, 7);
  const rings = xs.map((x) => {
    const t = (x + 0.795) / -0.091;
    const yU = TAIL.low(Math.max(-0.876, x)) + 0.004;
    const yL = yU - lerp(0.016, 0.044, Math.sqrt(t));
    const w = TAIL.w(Math.max(-0.876, x)) * 0.94;
    return [[x, yL, -w * 0.82], [x, yL - 0.004, 0], [x, yL, w * 0.82], [x, yU, w * 0.9], [x, yU + 0.002, 0], [x, yU, -w * 0.9]];
  });
  grp.add(mesh(loft(rings, { closed: true, su: 2, sv: 2 }), M.lensRed, 'TailLightLens'));
  const leds = [];
  for (let i = 0; i < 3; i++) {
    const x = -0.845 - i * 0.016;
    const y = TAIL.low(Math.max(-0.876, x)) - 0.01 - i * 0.008;
    const w = TAIL.w(Math.max(-0.876, x)) * 0.72;
    leds.push(rod(v3(x - 0.004, y, -w), v3(x - 0.004, y, w), 0.0028, 6));
  }
  grp.add(mesh(merge(leds), M.ledRed, 'TailLightLED'));
  // undertray / licence-plate holder extending rearwards
  {
    // short arm from under the tail light back to the plate
    const xs2 = linspace(-0.72, -0.935, 10);
    const rr = xs2.map((x, i) => {
      const t = i / (xs2.length - 1);
      const yt = lerp(0.872, 0.842, t);
      const yb = lerp(0.852, 0.826, t);
      const w = lerp(0.062, 0.034, Math.pow(t, 1.2));
      return [[x, yt, -w * 0.8], [x, yt + 0.004, 0], [x, yt, w * 0.8], [x, (yt + yb) / 2, w], [x, yb, w * 0.75], [x, yb - 0.002, 0], [x, yb, -w * 0.75], [x, (yt + yb) / 2, -w]];
    });
    grp.add(mesh(loft(rr, { closed: true, su: 2, sv: 2 }), M.plastic, 'PlateHolderArm'));
    // vertical bracket down to the plate
    const blade = sweep(
      [v3(-0.908, 0.838, 0), v3(-0.922, 0.812, 0), v3(-0.936, 0.79, 0)],
      (t) => rrect(0.012, lerp(0.09, 0.08, t), 0.004, 2),
      { steps: 16, up: v3(0, 1, 0) }
    );
    grp.add(mesh(blade, M.plastic, 'PlateBracket'));
    // licence plate (black dealer plate with the wordmark), leaning back
    const plate = place(rbox(0.004, 0.11, 0.17, 0.006), { p: [-0.964, 0.748, 0], r: [0, 0, -0.55] });
    grp.add(mesh(plate, M.plate || M.plastic, 'LicencePlate'));
    grp.add(mesh(place(rbox(0.008, 0.026, 0.07, 0.004), { p: [-0.93, 0.808, 0], r: [0, 0, -0.55] }), M.reflector, 'RearReflector'));
    const stalks = [];
    const lensG = [];
    for (const s of [-1, 1]) {
      stalks.push(rod(v3(-0.84, 0.857, s * 0.035), v3(-0.845, 0.852, s * 0.115), 0.0055, 10));
      lensG.push(place(rbox(0.046, 0.022, 0.028, 0.009), { p: [-0.852, 0.851, s * 0.128] }));
    }
    grp.add(mesh(merge(stalks), M.plastic, 'RearSignalStalks'));
    grp.add(mesh(merge(lensG), M.amber, 'RearSignals'));
  }
  return grp;
}

// ===========================================================================
// Front fender, mirrors, front signals and reflectors, instruments
// ===========================================================================
function buildFender(M) {
  const grp = new THREE.Group();
  grp.name = 'FrontFender';
  const angs = linspace(40, 124, 18).map((a) => a * DEG);
  const rings = angs.map((a, i) => {
    const t = i / (angs.length - 1);
    const k = 0.55 + 0.45 * smooth(0, 0.3, t) - 0.08 * smooth(0.85, 1, t);
    const lift = 0.01 * (1 - smooth(0, 0.25, t));
    const half = [[0, 0.322 + lift], [0.026 * k, 0.32 + lift * 0.8], [0.046 * k, 0.315], [0.06 * k, 0.304], [0.066 * k, 0.29]];
    return mirrorRing(half.map(([z, r]) => [FA.x + r * Math.cos(a), FA.y + r * Math.sin(a), z]));
  });
  grp.add(mesh(loft(rings, { su: 3, sv: 2, creaseCols: [2, 6] }), M.primary, 'Fender'));
  // black side stays down the front of the fork legs, carrying the reflectors
  const fins = [];
  const refl = [];
  for (const s of [-1, 1]) {
    const path = [];
    for (let i = 0; i <= 8; i++) {
      const sAx = lerp(0.33, 0.12, i / 8);
      const p = forkAt(sAx).addScaledVector(PF, 0.03 + 0.004 * Math.sin((Math.PI * i) / 8));
      p.z = s * 0.106;
      path.push(p);
    }
    fins.push(sweep(path, (t) => rrect(0.006, lerp(0.05, 0.03, t), 0.0025, 2), { steps: 16, up: PF.clone() }));
    const rp = forkAt(0.215).addScaledVector(PF, 0.05);
    const r = new THREE.CylinderGeometry(0.0115, 0.0115, 0.006, 24);
    r.rotateX(Math.PI / 2);
    r.translate(rp.x, rp.y, s * 0.112);
    refl.push(r);
  }
  grp.add(mesh(merge(fins), M.plastic, 'FenderStays'));
  grp.add(mesh(merge(refl), M.amber, 'ForkReflectors'));
  return grp;
}

// Mirror: angular housing whose large flat back carries the glass and whose
// front shell tapers to a blunt point (front-view outline traced from the
// studio close-up). Built for the right side and mirrored.
const MIRROR_OUTLINE = [[0.0, -0.02], [0.105, -0.036], [0.15, -0.016], [0.146, 0.05], [0.01, 0.024]];
function chamfered(pts, d = 0.007) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    out.push([p[0] + ((a[0] - p[0]) * d) / da, p[1] + ((a[1] - p[1]) * d) / da]);
    out.push([p[0] + ((b[0] - p[0]) * d) / db, p[1] + ((b[1] - p[1]) * d) / db]);
  }
  return out;
}
function buildMirrors(M) {
  const grp = new THREE.Group();
  grp.name = 'Mirrors';
  const stalks = [];
  const shells = [];
  const glass = [];
  const c = { x: 0.668, y: 0.987, z: 0.212 };
  const ring = chamfered(MIRROR_OUTLINE, 0.005);
  const cz = 0.09;
  const cy = 0.01;
  // back plane at x = c.x; faceted shell tapering to a flat front that sits
  // low, so from the side the housing reads as a forward-leaning wedge
  const sections = [[0, 1.0, 0], [0.006, 1.0, 0], [0.042, 0.84, -0.006], [0.078, 0.42, -0.02]];
  const rings = sections.map(([dx, k, dy]) => ring.map(([zz, yy]) => [c.x + dx, c.y + cy + dy + (yy - cy) * k, c.z + cz + (zz - cz) * k]));
  const shell = loft(rings, { closed: true, su: 1, sv: 1 });
  // front cap closing the shell
  const front = rings[rings.length - 1];
  const fc = front.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / front.length);
  const capPos = [fc[0] + 0.002, fc[1], fc[2]];
  front.forEach((p) => capPos.push(p[0], p[1], p[2]));
  const capIdx = [];
  for (let i = 0; i < front.length; i++) capIdx.push(0, 1 + ((i + 1) % front.length), 1 + i);
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
  cap.setIndex(capIdx);
  cap.computeVertexNormals();
  // back face (glass side) faces the rider
  const backShape = new THREE.Shape(ring.map(([zz, yy]) => new THREE.Vector2(zz, yy)));
  const back = new THREE.ShapeGeometry(backShape);
  const glassShape = new THREE.Shape(ring.map(([zz, yy]) => new THREE.Vector2(cz + (zz - cz) * 0.88, cy + (yy - cy) * 0.82)));
  const gl = new THREE.ShapeGeometry(glassShape);
  // shape (zz, yy) in the x-y plane -> bike (z, y), facing -x
  const toBike = (g, x) => {
    g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    g.translate(x, c.y, c.z);
    return g;
  };
  toBike(back, c.x - 0.0004);
  toBike(gl, c.x - 0.0012);
  // make sure the back faces rearwards
  const bn = back.attributes.normal;
  if (bn.getX(0) > 0) {
    const a = back.index.array;
    for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
    back.computeVertexNormals();
  }
  const gn = gl.attributes.normal;
  if (gn.getX(0) > 0) {
    const a = gl.index.array;
    for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
    gl.computeVertexNormals();
  }
  const housing = merge([shell, cap, back]);
  const stalk = sweep([v3(0.728, 0.9, 0.2), v3(0.73, 0.93, 0.232), v3(0.722, 0.962, 0.262)], (t) => rrect(0.016, lerp(0.026, 0.02, t), 0.006, 2), {
    steps: 10,
    up: v3(1, 0, 0),
  });
  const foot = place(rbox(0.034, 0.012, 0.032, 0.004), { p: [0.728, 0.897, 0.2] });
  for (const s of [1, -1]) {
    shells.push(s > 0 ? housing.clone() : mirrorZ(housing));
    glass.push(s > 0 ? gl.clone() : mirrorZ(gl));
    const st = merge([stalk.clone(), foot.clone()]);
    stalks.push(s > 0 ? st : mirrorZ(st));
  }
  grp.add(mesh(merge(stalks), M.plastic, 'MirrorStalks'));
  grp.add(mesh(merge(shells), M.plasticGloss, 'MirrorHousings'));
  grp.add(mesh(merge(glass), M.chrome, 'MirrorGlass'));
  return grp;
}

// Louvred vents behind the mid panels, where hot air leaves the radiator:
// a black frame with vertical slats angled rearwards (traced from the 3/4
// studio photo: x 0.13-0.255, y 0.545-0.63, just inside the fairing).
function buildRadiatorVents(M) {
  const frame = [];
  const slats = [];
  const x0 = 0.132;
  const x1 = 0.254;
  const yb = (x) => 0.545 + 0.02 * (x - x0) / (x1 - x0);
  const yt = (x) => 0.628 - 0.004 * (x - x0) / (x1 - x0);
  for (const s of [-1, 1]) {
    const z = s * 0.192;
    // dark back plate and a frame round the opening
    frame.push(place(rbox(x1 - x0 + 0.01, 0.092, 0.004, 0.0015), { p: [(x0 + x1) / 2, 0.588, s * 0.18] }));
    frame.push(sweep([v3(x0, yb(x0), z), v3(x1, yb(x1), z), v3(x1, yt(x1), z), v3(x0, yt(x0), z), v3(x0, yb(x0), z)], () => rrect(0.006, 0.014, 0.002, 1), { steps: 4, up: v3(0, 0, 1), spline: false }));
    // vertical slats, each turned 35 deg so they read as louvres
    const n = 9;
    for (let i = 1; i < n; i++) {
      const x = lerp(x0, x1, i / n);
      const h = yt(x) - yb(x) - 0.004;
      slats.push(place(rbox(0.0035, h, 0.013, 0.001), { p: [x, (yt(x) + yb(x)) / 2, z - s * 0.003], r: [0, s * 0.6, 0] }));
    }
  }
  const grp = new THREE.Group();
  grp.name = 'RadiatorVents';
  grp.add(mesh(merge(frame), M.plastic, 'VentFrames'));
  grp.add(mesh(merge(slats), M.plasticGloss, 'VentSlats'));
  return grp;
}

function buildFrontSignals(M) {
  // large clear-lens indicators under the "Ninja" panel, tapering down and
  // back along the front edge of the mid panel (traced from the side photo)
  const lens = [];
  const refl = [];
  const bulbs = [];
  const pts = [[0.664, 0.636, 1], [0.594, 0.632, 1], [0.538, 0.552, 1], [0.551, 0.546, 1], [0.622, 0.598, 1]];
  for (const s of [-1, 1]) {
    const g = buildPanel({ outline: pts, surface: (x, y) => sideW(x, y) + 0.004, roll: 0.004, flange: 0.012, spacing: 0.006, edgeStep: 0.003 });
    lens.push(s > 0 ? g : mirrorZ(g));
    const r = buildPanel({ outline: pts, surface: (x, y) => sideW(x, y) - 0.012, roll: 0.003, flange: 0, spacing: 0.006, edgeStep: 0.003, uv: (u, v) => [u / 0.03, v / 0.03] });
    refl.push(s > 0 ? r : mirrorZ(r));
    bulbs.push(place(rbox(0.026, 0.012, 0.012, 0.005), { p: [0.628, 0.618, s * (sideW(0.628, 0.618) - 0.008)], r: [0, 0, -0.5] }));
  }
  const grp = new THREE.Group();
  grp.name = 'FrontSignals';
  const lm = mesh(merge(lens), M.lens, 'FrontSignalLens');
  lm.renderOrder = 3;
  grp.add(lm);
  grp.add(mesh(merge(refl), M.headlightInner, 'FrontSignalReflector'));
  grp.add(mesh(merge(bulbs), M.amber, 'FrontSignalBulb'));
  return grp;
}

function buildInstruments(M) {
  const grp = new THREE.Group();
  grp.name = 'Instruments';
  grp.add(mesh(rbox(0.036, 0.086, 0.2, 0.012), M.plastic, 'GaugeHousing'));
  const gauge = createGauge();
  M.gauge = gauge;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.184, 0.084),
    new THREE.MeshStandardMaterial({
      map: gauge ? gauge.texture : null,
      emissiveMap: gauge ? gauge.texture : null,
      emissive: '#ffffff',
      emissiveIntensity: gauge ? 0.5 : 0,
      roughness: 0.2,
      color: gauge ? '#ffffff' : '#111',
    })
  );
  face.name = 'GaugeFace';
  face.material.name = 'gauge';
  face.rotation.y = -Math.PI / 2;
  face.position.x = -0.0186;
  grp.add(face);
  // tucked under the screen: lower, further forward and more upright than
  // before (traced from the side photos, where it sits below the cowl line)
  grp.position.set(0.598, 0.93, 0);
  grp.rotation.z = -30 * DEG;
  return grp;
}

// ===========================================================================
export function buildBodywork(M) {
  const grp = new THREE.Group();
  grp.name = 'Bodywork';
  const R = M.decalSide;
  const Lm = M.decalSideL;
  grp.add(buildNose(M));
  grp.add(buildWindscreen(M));
  grp.add(buildInstruments(M));
  grp.add(sidePanel(P1, R, Lm, 'UpperSideCowl', { spacing: 0.009 }));
  grp.add(sidePanel(P2, R, Lm, 'MidSideCowl'));
  grp.add(sidePanel(P3, R, Lm, 'SideCover', { spacing: 0.009 }));
  grp.add(sidePanel(P3B, M.plastic, M.plastic, 'SeatSideCover'));
  grp.add(sidePanel(P4, M.decalLower, M.decalLowerL, 'LowerFairing', { flange: 0.012 }));
  grp.add(sidePanel(INNER, M.plastic, M.plastic, 'InnerCover', { roll: 0.004, flange: 0.01 }));
  grp.add(sidePanel(LINER, M.ventDark, M.ventDark, 'FairingLiner', { roll: 0, flange: 0, spacing: 0.02 }));
  grp.add(sidePanel(CHIN_SIDE, M.primary, M.primary, 'ChinSide', { roll: 0.004, flange: 0.01, spacing: 0.006, edgeStep: 0.003 }));
  grp.add(bellyPan(M));
  grp.add(buildTank(M, R, Lm));
  grp.add(buildSeats(M));
  grp.add(buildTail(M, R, Lm));
  grp.add(buildTailEnd(M));
  grp.add(buildFender(M));
  grp.add(buildMirrors(M));
  grp.add(buildFrontSignals(M));
  grp.add(buildRadiatorVents(M));
  return grp;
}

// Livery artwork drawn on canvases at runtime (no external images).
//
// SIDE: one texture for every side-facing panel (fairings, side covers, tail),
// mapped with a side projection over SIDE_BOX. FRONT: the nose panels, mapped
// with a front projection over FRONT_BOX. Coordinates below are the traced
// positions of the 2019 KRT Edition graphics, in metres.
import * as THREE from 'three';

export const SIDE_BOX = { X0: -1.02, X1: 1.0, Y0: 0.1, Y1: 1.11 };
export const FRONT_BOX = { Z0: -0.26, Z1: 0.26, Y0: 0.66, Y1: 0.96 };

const canvas = (w, h) => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

function finish(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export const sideUV = (x, y) => [(x - SIDE_BOX.X0) / (SIDE_BOX.X1 - SIDE_BOX.X0), (y - SIDE_BOX.Y0) / (SIDE_BOX.Y1 - SIDE_BOX.Y0)];
// front panels are built in (u, v) = (-z, y)
export const frontUV = (u, v) => [(-u - FRONT_BOX.Z0) / (FRONT_BOX.Z1 - FRONT_BOX.Z0), (v - FRONT_BOX.Y0) / (FRONT_BOX.Y1 - FRONT_BOX.Y0)];

function painter(c, box, flipX = false) {
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const sx = W / (box.X1 - box.X0);
  const sy = H / (box.Y1 - box.Y0);
  const P = (x, y) => [((x - box.X0) / (box.X1 - box.X0)) * W, (1 - (y - box.Y0) / (box.Y1 - box.Y0)) * H];
  const poly = (pts, fill) => {
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const [px, py] = P(x, y);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  // band of constant width w between A and B (perpendicular offset d)
  const band = (A, B, d, w, fill, skew = 0) => {
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const l = Math.hypot(dx, dy);
    const nx = -dy / l;
    const ny = dx / l;
    const o = (Q, k) => [Q[0] + nx * k, Q[1] + ny * k];
    poly([o(A, d), o([B[0] + skew, B[1]], d), o([B[0] + skew, B[1]], d + w), o(A, d + w)], fill);
  };
  // slanted parallelogram "slash": centre c, length l along dir, thickness t, lean
  const slash = (cx, cy, l, t, fill, ang = 0.18, lean = 0.55) => {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const a = [cx - (ux * l) / 2, cy - (uy * l) / 2];
    const b = [cx + (ux * l) / 2, cy + (uy * l) / 2];
    poly([a, b, [b[0] + lean * t, b[1] + t], [a[0] + lean * t, a[1] + t]], fill);
  };
  const text = (x, y, str, size, { font = 'Arial', weight = '800', style = 'italic', color = '#fff', rot = 0, sxk = 1, align = 'center' } = {}) => {
    const [px, py] = P(x, y);
    g.save();
    g.translate(px, py);
    if (flipX) g.scale(-1, 1);
    g.rotate(rot);
    g.scale(sxk, 1);
    g.font = `${style} ${weight} ${Math.round(size * sy)}px ${font}`;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillText(str, 0, 0);
    g.restore();
  };
  return { g, P, poly, band, slash, text, sx, sy, W, H };
}

// Web fonts are used when the page has loaded them (the viewer re-draws the
// livery once fonts are ready); otherwise the system fallbacks apply.
export const LIVERY_FONTS = ['700 64px "Kaushan Script"', 'italic 800 64px "Kanit"'];
const SCRIPT = '"Kaushan Script", "Brush Script MT", "Segoe Script", "Snell Roundhand", cursive';
const BOLD = '"Kanit", "Arial Black", "Helvetica Neue", Arial, sans-serif';

// ---------------------------------------------------------------- side
// KRT side graphics traced from the calibrated 2019 studio side photo
// (bike side-view metres; same layout on both sides). Colour keys:
// A lime, B yellow-green, C silver, D graphite (per livery).
const TRACED_SIDE = [
  ['D', [[0.22, 0.554], [0.438, 0.495], [0.382, 0.437], [0.347, 0.383], [0.22, 0.439]]], // mid graphite field (143.8 cm2)
  ['D', [[0.360, 0.616], [0.369, 0.625], [0.378, 0.625], [0.488, 0.597], [0.531, 0.590], [0.536, 0.586], [0.536, 0.578], [0.533, 0.574], [0.373, 0.609]]], // mid graphite band (25.2 cm2)
  ['B', [[0.383, 0.637], [0.413, 0.665], [0.490, 0.646], [0.515, 0.620], [0.408, 0.644], [0.407, 0.640], [0.419, 0.625], [0.387, 0.632]]], // mid yellow arrow (24.4 cm2)
  ['A', [[0.341, 0.596], [0.347, 0.600], [0.383, 0.590], [0.405, 0.588], [0.425, 0.579], [0.436, 0.579], [0.441, 0.584], [0.452, 0.586], [0.455, 0.581], [0.478, 0.577], [0.495, 0.560], [0.508, 0.552], [0.508, 0.545], [0.481, 0.546], [0.415, 0.560], [0.406, 0.566], [0.371, 0.571], [0.355, 0.578], [0.341, 0.591]]], // mid lime slash (37.0 cm2)
  ['A', [[0.411, 0.540], [0.459, 0.539], [0.483, 0.534], [0.487, 0.529], [0.483, 0.525], [0.441, 0.529], [0.418, 0.534]]], // mid lime line (6.3 cm2)
  ['B', [[0.292, 0.547], [0.297, 0.555], [0.306, 0.555], [0.463, 0.512], [0.449, 0.499], [0.296, 0.541]]], // mid yellow line (26.6 cm2)
  ['B', [[0.425, 0.677], [0.431, 0.679], [0.454, 0.671], [0.445, 0.669], [0.429, 0.672]]], // mid yellow tip (1.5 cm2)
  ['A', [[0.441, 0.687], [0.450, 0.691], [0.453, 0.686], [0.461, 0.686], [0.466, 0.680], [0.443, 0.683]]], // mid lime tip (1.6 cm2)
  ['B', [[0.241, 0.421], [0.249, 0.421], [0.250, 0.418], [0.326, 0.379], [0.301, 0.380], [0.280, 0.399], [0.243, 0.417]]], // low yellow (5.7 cm2)
  ['A', [[-0.038, 0.803], [-0.036, 0.807], [-0.019, 0.807], [0.003, 0.814], [0.031, 0.812], [0.040, 0.807], [0.098, 0.791], [0.122, 0.779], [0.166, 0.768], [0.200, 0.756], [0.200, 0.752], [0.178, 0.744], [0.114, 0.767], [0.071, 0.774], [0.040, 0.785], [0.005, 0.790], [0.002, 0.793], [-0.036, 0.799]]], // p3 lime band (45.1 cm2)
  ['B', [[-0.066, 0.794], [0.070, 0.768], [0.172, 0.740], [0.172, 0.736], [0.162, 0.736], [0.065, 0.764], [-0.066, 0.790]]], // p3 yellow line (13.2 cm2)
  ['B', [[0.055, 0.744], [0.102, 0.730], [0.132, 0.703], [0.108, 0.699], [0.062, 0.734]]], // p3 yellow slash (11.7 cm2)
  ['B', [[0.233, 0.687], [0.222, 0.679], [0.165, 0.685], [0.166, 0.690], [0.204, 0.700], [0.214, 0.700], [0.224, 0.690]]], // p3 yellow slash2 (8.4 cm2)
  ['A', [[0.142, 0.659], [0.140, 0.655], [0.095, 0.643], [0.048, 0.654], [0.050, 0.658], [0.087, 0.669], [0.130, 0.665]]], // p3 lime slash (15.3 cm2)
  ['B', [[-0.027, 0.637], [-0.011, 0.640], [0.118, 0.610], [0.112, 0.599], [0.088, 0.599], [0.068, 0.618], [0.049, 0.611], [-0.025, 0.630]]], // p3 yellow bar (17.1 cm2)
  ['D', [[-0.818, 1.005], [-0.803, 1.003], [-0.653, 0.937], [-0.628, 0.937], [-0.629, 0.932], [-0.639, 0.927], [-0.638, 0.923], [-0.631, 0.920], [-0.636, 0.913], [-0.631, 0.909], [-0.624, 0.909], [-0.619, 0.898], [-0.610, 0.900], [-0.577, 0.882], [-0.534, 0.838], [-0.538, 0.831], [-0.529, 0.832], [-0.524, 0.828], [-0.527, 0.824], [-0.525, 0.818], [-0.486, 0.805], [-0.414, 0.796], [-0.361, 0.777], [-0.361, 0.771], [-0.414, 0.793], [-0.442, 0.790], [-0.448, 0.784], [-0.448, 0.780], [-0.436, 0.771], [-0.436, 0.766], [-0.428, 0.761], [-0.417, 0.761], [-0.414, 0.774], [-0.402, 0.774], [-0.391, 0.768], [-0.369, 0.747], [-0.367, 0.739], [-0.328, 0.724], [-0.331, 0.720], [-0.346, 0.720], [-0.352, 0.727], [-0.391, 0.743], [-0.425, 0.750], [-0.445, 0.767], [-0.472, 0.776], [-0.489, 0.786], [-0.507, 0.790], [-0.532, 0.788], [-0.538, 0.793], [-0.553, 0.793], [-0.557, 0.783], [-0.563, 0.785], [-0.569, 0.791], [-0.561, 0.789], [-0.560, 0.796], [-0.568, 0.804], [-0.574, 0.804], [-0.574, 0.808], [-0.601, 0.834], [-0.607, 0.834], [-0.614, 0.843], [-0.618, 0.843], [-0.618, 0.849], [-0.623, 0.850], [-0.650, 0.877], [-0.678, 0.900], [-0.689, 0.904], [-0.743, 0.953]]], // tail graphite (170.8 cm2)
  ['C', [[-0.790, 1.005], [-0.645, 0.968], [-0.615, 0.948], [-0.653, 0.962], [-0.653, 0.953], [-0.649, 0.949], [-0.645, 0.949], [-0.638, 0.940], [-0.627, 0.940], [-0.647, 0.935], [-0.684, 0.955], [-0.691, 0.955], [-0.712, 0.967], [-0.735, 0.974], [-0.740, 0.979], [-0.756, 0.983], [-0.756, 0.991], [-0.764, 0.995], [-0.772, 0.990], [-0.781, 0.994], [-0.782, 1.000], [-0.789, 0.997]]], // tail silver (28.8 cm2)
  ['C', [[-0.849, 0.977], [-0.836, 0.975], [-0.812, 0.961], [-0.790, 0.931], [-0.790, 0.925], [-0.798, 0.928], [-0.822, 0.955]]], // tail silver2 (6.8 cm2)
  ['B', [[-0.655, 0.956], [-0.642, 0.956], [-0.623, 0.944], [-0.617, 0.944], [-0.615, 0.939], [-0.626, 0.937], [-0.628, 0.941], [-0.638, 0.941]]], // tail accent (3.1 cm2)
];

export function sideLivery(L, mirror = false) {
  const c = canvas(3072, 1536);
  if (!c) return null;
  const box = { X0: SIDE_BOX.X0, X1: SIDE_BOX.X1, Y0: SIDE_BOX.Y0, Y1: SIDE_BOX.Y1 };
  const { g, poly, band, slash, text } = painter(c, box, mirror);
  const base = L.body.color;
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);
  const A = L.stripeA; // main colour stripe
  const B = L.stripeB; // bright accent
  const C = L.stripeC; // silver line
  const D = L.stripeD; // graphite panel

  // ---- upper cowl (P1): primary colour along the top front, under the screen
  // green band from the headlight's rear corner up along the screen base
  poly([[0.8, 0.858], [0.74, 0.886], [0.69, 0.912], [0.65, 0.934], [0.6, 0.955], [0.58, 1.0], [0.8, 1.0]], L.primary.color);
  // Graphics below are traced from the calibrated 2019 KRT side photo
  // (metres, same layout on both sides). quad(x0, y0, x1, y1, t) is a band
  // whose lower edge runs (x0, y0) -> (x1, y1) and whose height is t.
  const quad = (x0, y0, x1, y1, t, col, lead = 0) => poly([[x0 + lead, y0], [x1, y1], [x1, y1 + t], [x0, y0 + t]], col);
  // ---- KRT graphics on the mid panel, side cover and tail: polygons traced
  // from the 2019 KRT studio side photo (colour regions extracted and
  // simplified to ~2.5 mm), painted graphite first, then colours
  const COL = { A, B, C, D };
  for (const pass of ['D', 'A', 'B', 'C']) for (const [k, pts] of TRACED_SIDE) if (k === pass) poly(pts, COL[k]);
  // silver line along the rear lower edge of the side cover, up to the seat
  poly([[0.06, 0.69], [-0.18, 0.742], [-0.18, 0.764], [0.06, 0.702]], C);
  // ---- lower fairing (P4): dark graphite with the team wordmark
  poly([[0.44, 0.39], [0.44, 0.14], [-0.11, 0.14], [-0.11, 0.37], [0.25, 0.392], [0.33, 0.383]], L.lower || L.body.color);
  text(0.07, 0.276, 'Kawasaki', 0.042, { font: BOLD, weight: '900', style: 'italic', color: '#f2f3f4', rot: -0.07, sxk: 1.05 });
  if (L.id === 'krt') text(0.065, 0.246, 'Racing Team', 0.022, { font: BOLD, weight: '800', style: 'italic', color: '#d5d8db', rot: -0.07 });
  // ---- upper cowl script
  text(0.577, 0.697, 'Ninja', 0.058, { font: SCRIPT, weight: '700', style: 'italic', color: '#dfe2e5', rot: -0.13 });
  // ---- tank: primary colour wherever it is projected (wordmark is a decal)
  poly([[0.36, 0.84], [0.36, 1.05], [-0.16, 1.05], [-0.16, 0.84]], L.primary.color);
  return finish(c);
}

// ---------------------------------------------------------------- tank wordmark
export function tankLogo(L) {
  const c = canvas(1024, 192);
  if (!c) return null;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.font = `italic 800 132px ${BOLD}`;
  g.fillStyle = L.tankLogo || '#0d0e10';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(c.width / 2, c.height / 2 + 6);
  g.scale(1.06, 1);
  g.fillText('Kawasaki', 0, 0);
  g.restore();
  return finish(c);
}

// ---------------------------------------------------------------- front (nose)
export function frontLivery(L) {
  const c = canvas(1024, 600);
  if (!c) return null;
  const box = { X0: FRONT_BOX.Z0, X1: FRONT_BOX.Z1, Y0: FRONT_BOX.Y0, Y1: FRONT_BOX.Y1 };
  const { g, poly } = painter(c, box);
  g.fillStyle = L.primary.color;
  g.fillRect(0, 0, c.width, c.height);
  // Black wedge over the outer half of each headlight and down its outer end
  // (traced from the 2019 studio photos): the green V arm follows the lens
  // top edge only as far as z = 0.165, then rises to the mirror mount.
  const seam = 'rgba(0,0,0,0.55)';
  for (const s of [-1, 1]) {
    const wedge = [[s * 0.165, 0.8], [s * 0.2, 0.839], [s * 0.235, 0.868], [s * 0.27, 0.893], [s * 0.27, 0.66], [s * 0.232, 0.66], [s * 0.232, 0.82]];
    poly(wedge, L.body.color);
    // thin shadow line along the edge of the green arm
    for (let i = 0; i < 3; i++) {
      const [a, b] = [wedge[i], wedge[i + 1]];
      poly([a, b, [b[0], b[1] + 0.0016], [a[0], a[1] + 0.0016]], seam);
    }
  }
  return finish(c);
}

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
  // ---- mid panel (P2): black at the front, graphite lower field, bold bands
  poly([[0.6, 0.5], [0.5, 0.515], [0.29, 0.562], [0.2, 0.575], [0.2, 0.372], [0.46, 0.368], [0.62, 0.42]], D);
  quad(0.535, 0.582, 0.3, 0.603, 0.018, D);
  quad(0.515, 0.544, 0.31, 0.572, 0.016, A, 0.01);
  quad(0.5, 0.505, 0.285, 0.553, 0.022, B, 0.012);
  quad(0.53, 0.622, 0.4, 0.647, 0.026, A, 0.02);
  quad(0.49, 0.664, 0.4, 0.683, 0.014, A, 0.01);
  quad(0.335, 0.383, 0.22, 0.42, 0.012, A, 0.006);
  // ---- side cover (P3): long bands rising to the rear under the tank
  quad(0.21, 0.762, -0.12, 0.822, 0.015, A, 0.012);
  quad(0.19, 0.738, -0.12, 0.796, 0.01, B, 0.01);
  quad(0.145, 0.704, 0.05, 0.736, 0.022, A, 0.025);
  quad(0.235, 0.688, 0.165, 0.697, 0.012, A, 0.008);
  quad(0.2, 0.662, -0.12, 0.676, 0.014, D);
  quad(0.115, 0.646, 0.05, 0.654, 0.01, A, 0.006);
  quad(0.02, 0.632, -0.04, 0.639, 0.009, A, 0.005);
  // silver line along the rear lower edge of the side cover, up to the seat
  poly([[0.06, 0.69], [-0.18, 0.742], [-0.18, 0.764], [0.06, 0.702]], C);
  // ---- lower fairing (P4): black with the team wordmark
  text(0.07, 0.276, 'Kawasaki', 0.042, { font: BOLD, weight: '900', style: 'italic', color: '#f2f3f4', rot: -0.07, sxk: 1.05 });
  if (L.id === 'krt') text(0.065, 0.246, 'Racing Team', 0.022, { font: BOLD, weight: '800', style: 'italic', color: '#d5d8db', rot: -0.07 });
  // ---- upper cowl script
  text(0.577, 0.697, 'Ninja', 0.058, { font: SCRIPT, weight: '700', style: 'italic', color: '#dfe2e5', rot: -0.13 });
  // ---- tail cowl: graphite side with a silver swoosh and colour insert
  poly(
    [
      [-0.3, 0.74], [-0.4, 0.75], [-0.48, 0.778], [-0.56, 0.8], [-0.62, 0.832], [-0.68, 0.876], [-0.75, 0.918], [-0.82, 0.95], [-0.92, 0.975],
      [-0.92, 1.022], [-0.82, 1.0], [-0.75, 0.979], [-0.7, 0.963], [-0.65, 0.936], [-0.6, 0.894], [-0.55, 0.86], [-0.5, 0.826], [-0.44, 0.796],
      [-0.38, 0.775], [-0.3, 0.762],
    ],
    D
  );
  poly([[-0.62, 0.938], [-0.86, 1.0], [-0.86, 1.01], [-0.64, 0.962]], C);
  quad(-0.59, 0.944, -0.66, 0.958, 0.008, B, -0.012);
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
  // dark brows over the outer half of each headlight
  for (const s of [-1, 1]) {
    poly([[s * 0.1, 0.792], [s * 0.2, 0.828], [s * 0.26, 0.85], [s * 0.26, 0.9], [s * 0.2, 0.855], [s * 0.12, 0.81]], L.body.color);
  }
  return finish(c);
}

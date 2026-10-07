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
  poly([[0.6, 0.915], [0.66, 0.896], [0.7, 0.882], [0.76, 0.864], [0.8, 0.862], [0.8, 1.0], [0.58, 1.0]], L.primary.color);
  // ---- mid side (P2): graphite field with stacked slashes rising forward
  poly([[0.75, 0.70], [0.24, 0.66], [0.22, 0.36], [0.47, 0.36], [0.75, 0.62]], D);
  poly([[0.75, 0.70], [0.58, 0.695], [0.50, 0.672], [0.75, 0.672]], base);
  slash(0.53, 0.648, 0.13, 0.012, A, 0.16);
  slash(0.51, 0.625, 0.17, 0.014, B, 0.16);
  slash(0.47, 0.596, 0.2, 0.012, A, 0.17);
  slash(0.42, 0.567, 0.23, 0.02, B, 0.18);
  slash(0.39, 0.53, 0.22, 0.012, A, 0.19);
  slash(0.34, 0.455, 0.16, 0.012, B, 0.22);
  slash(0.31, 0.43, 0.1, 0.008, A, 0.22);
  // ---- side cover (P3): long bands sweeping back under the tank
  band([0.31, 0.745], [-0.11, 0.81], 0, 0.016, A);
  band([0.26, 0.72], [-0.11, 0.785], 0, 0.009, B);
  band([0.22, 0.70], [-0.11, 0.755], 0, 0.006, C);
  slash(0.2, 0.672, 0.12, 0.014, A, 0.16);
  slash(0.12, 0.66, 0.1, 0.01, B, 0.16);
  poly([[0.06, 0.64], [-0.11, 0.66], [-0.11, 0.70], [0.04, 0.68]], D);
  // ---- lower fairing (P4): graphite lower front, wordmark
  poly([[0.43, 0.2], [0.43, 0.32], [0.33, 0.33], [0.22, 0.25], [0.2, 0.15], [0.43, 0.15]], D);
  band([0.42, 0.335], [0.24, 0.26], 0, 0.006, B);
  text(0.12, 0.29, 'Kawasaki', 0.046, { font: BOLD, weight: '900', style: 'italic', color: '#f2f3f4', rot: -0.07, sxk: 1.05 });
  text(0.11, 0.247, 'Racing Team', 0.024, { font: BOLD, weight: '800', style: 'italic', color: '#d5d8db', rot: -0.07 });
  // ---- upper cowl script
  text(0.575, 0.722, 'Ninja', 0.052, { font: SCRIPT, weight: '700', style: 'italic', color: '#d9dcdf', rot: -0.1 });
  // ---- tail cowl: graphite side with a silver swoosh and colour insert
  poly([[-0.3, 0.77], [-0.5, 0.79], [-0.66, 0.875], [-0.8, 0.94], [-0.9, 0.97], [-0.9, 0.9], [-0.3, 0.7]], D);
  band([-0.36, 0.8], [-0.86, 0.99], 0, 0.006, C);
  poly([[-0.6, 0.955], [-0.72, 0.985], [-0.78, 1.0], [-0.66, 1.0], [-0.58, 0.985]], L.primary.color);
  text(-0.6, 0.905, 'ZX-6R', 0.03, { font: BOLD, weight: '900', style: 'italic', color: C, rot: -0.38, sxk: 1.1 });
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

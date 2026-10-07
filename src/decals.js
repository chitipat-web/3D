// Livery artwork drawn on canvases at runtime (no external images).
// Side-fairing textures are mapped with a side projection:
//   u = (x - X0) / (X1 - X0), v = (y - Y0) / (Y1 - Y0)
import * as THREE from 'three';

export const SIDE_BOX = { X0: -0.16, X1: 0.9, Y0: 0.12, Y1: 0.94 };
export const TAIL_BOX = { X0: -1.0, X1: -0.15, Y0: 0.66, Y1: 1.0 };

function canvas(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Map metres (side view) to canvas pixels.
function mapper(c, box) {
  return (x, y) => [((x - box.X0) / (box.X1 - box.X0)) * c.width, (1 - (y - box.Y0) / (box.Y1 - box.Y0)) * c.height];
}

function poly(g, P, pts, fill) {
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const [px, py] = P(x, y);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function textAt(g, P, x, y, str, sizeM, { color = '#fff', font = 'Arial', weight = '800', style = 'italic', rotate = 0, mirror = false, align = 'center', scaleX = 1 } = {}, c, box) {
  const [px, py] = P(x, y);
  const pxPerM = c.width / (box.X1 - box.X0);
  g.save();
  g.translate(px, py);
  if (mirror) g.scale(-1, 1);
  g.rotate(rotate);
  g.scale(scaleX, 1);
  g.font = `${style} ${weight} ${Math.round(sizeM * pxPerM)}px ${font}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(str, 0, 0);
  g.restore();
}

// ---------------------------------------------------------------------------
// Side fairing: base colour + KRT-style diagonal stripes + "Ninja" script.
// mirror = true for the left side (text drawn mirrored so it reads correctly).
// ---------------------------------------------------------------------------
export function sideTexture(L, mirror = false) {
  const c = canvas(2048, 1580);
  if (!c) return null;
  const g = c.getContext('2d');
  const P = mapper(c, SIDE_BOX);
  g.fillStyle = L.body.color;
  g.fillRect(0, 0, c.width, c.height);
  // parallel band along a line from A to B (side-view metres), offset d, width w
  const band = (A, B, d, w, col, taper = 0) => {
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const p = (Q, o) => [Q[0] + nx * o, Q[1] + ny * o];
    poly(g, P, [p(A, d), p(B, d - taper), p(B, d + w - taper * 0.5), p(A, d + w)], col);
  };
  // graphite wedge in the lower half, pointing forward
  poly(g, P, [[0.06, 0.24], [0.36, 0.25], [0.64, 0.47], [0.62, 0.5], [0.2, 0.42], [0.04, 0.36]], L.stripeD);
  // lower stripe group: rising towards the front
  const LA = [0.08, 0.36];
  const LB = [0.66, 0.535];
  band(LA, LB, 0.0, 0.028, L.stripeB);
  band(LA, LB, 0.036, 0.022, L.stripeA);
  band(LA, LB, 0.064, 0.006, L.stripeC);
  // upper stripe group: falling towards the front, meeting the lower one in an arrow
  const UA = [0.02, 0.775];
  const UB = [0.64, 0.6];
  band(UA, UB, -0.028, 0.026, L.stripeA);
  band(UA, UB, -0.056, 0.02, L.stripeB);
  band(UA, UB, -0.07, 0.006, L.stripeC);
  // short flash on the panel under the tank
  band([0.12, 0.79], [0.42, 0.79], -0.012, 0.01, L.stripeC);
  // cheek behind the headlight: silver flash under the script
  poly(g, P, [[0.64, 0.8], [0.86, 0.835], [0.86, 0.845], [0.66, 0.812]], L.stripeC);
  // vent shadow behind the front wheel
  poly(g, P, [[0.45, 0.6], [0.55, 0.655], [0.57, 0.637], [0.48, 0.565]], '#050505');
  // lettering
  textAt(g, P, 0.75, 0.858, 'Ninja', 0.05, { color: L.script, font: '"Brush Script MT", "Segoe Script", cursive', weight: '700', style: 'italic', rotate: -0.12, mirror }, c, SIDE_BOX);
  textAt(g, P, 0.16, 0.235, 'ZX-6R', 0.042, { color: L.script, font: 'Arial Black, Arial, sans-serif', weight: '900', style: 'italic', rotate: -0.08, mirror, scaleX: 1.25 }, c, SIDE_BOX);
  return finish(c);
}

export function tailTexture(L, mirror = false) {
  const c = canvas(1536, 640);
  if (!c) return null;
  const g = c.getContext('2d');
  const P = mapper(c, TAIL_BOX);
  g.fillStyle = L.primary.color;
  g.fillRect(0, 0, c.width, c.height);
  // black lower half rising to the tip
  poly(g, P, [[-1.0, 0.6], [-0.15, 0.6], [-0.15, 0.74], [-0.45, 0.77], [-0.7, 0.82], [-0.92, 0.9], [-1.0, 0.93]], L.body.color);
  // silver pin line along the split
  poly(g, P, [[-0.15, 0.742], [-0.45, 0.772], [-0.7, 0.822], [-0.92, 0.902], [-0.92, 0.91], [-0.7, 0.83], [-0.45, 0.78], [-0.15, 0.75]], L.stripeC);
  textAt(g, P, -0.6, 0.79, '636', 0.032, { color: L.stripeC, font: 'Arial Black, Arial, sans-serif', weight: '900', style: 'italic', rotate: -0.2, mirror, scaleX: 1.3 }, c, TAIL_BOX);
  return finish(c);
}

export function gaugeTexture() {
  const c = canvas(512, 256);
  if (!c) return null;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0c0e';
  g.fillRect(0, 0, 512, 256);
  // analogue tachometer on the left
  const cx = 150;
  const cy = 140;
  g.strokeStyle = '#d9dde2';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, 100, Math.PI * 0.75, Math.PI * 2.25);
  g.stroke();
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * 0.75 + (i / 16) * Math.PI * 1.5;
    const r0 = i % 2 === 0 ? 82 : 90;
    g.strokeStyle = i >= 13 ? '#e3342f' : '#d9dde2';
    g.beginPath();
    g.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
    g.lineTo(cx + 98 * Math.cos(a), cy + 98 * Math.sin(a));
    g.stroke();
    if (i % 2 === 0) {
      g.fillStyle = '#d9dde2';
      g.font = 'bold 16px Arial';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i), cx + 66 * Math.cos(a), cy + 66 * Math.sin(a));
    }
  }
  g.strokeStyle = '#ff5a1f';
  g.lineWidth = 5;
  const na = Math.PI * 0.75 + 0.1;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + 88 * Math.cos(na), cy + 88 * Math.sin(na));
  g.stroke();
  // LCD on the right
  g.fillStyle = '#1d2a2f';
  g.fillRect(290, 50, 200, 150);
  g.fillStyle = '#cfe9f2';
  g.font = 'bold 72px Arial';
  g.textAlign = 'right';
  g.fillText('0', 470, 120);
  g.font = 'bold 18px Arial';
  g.fillText('km/h', 470, 165);
  g.textAlign = 'left';
  g.fillText('N', 305, 80);
  g.fillText('ODO 00636', 305, 188);
  const t = finish(c);
  return t;
}

// Headlight lens art. u runs from the inner (beak) end to the outer end,
// v from the chin (bottom) to the brow (top). glow = emissive mask.
export function headlightTexture(glow = false) {
  const c = canvas(1024, 256);
  if (!c) return null;
  const g = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  // lens body: bright chrome reflector behind clear glass
  if (glow) {
    g.fillStyle = '#060606';
    g.fillRect(0, 0, W, H);
  } else {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#e9edf2');
    grd.addColorStop(0.45, '#9da5af');
    grd.addColorStop(0.75, '#5b626b');
    grd.addColorStop(1, '#2a2e33');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // facet lines of the reflector
    g.strokeStyle = 'rgba(40,44,50,0.35)';
    g.lineWidth = 3;
    for (let i = 1; i < 9; i++) {
      g.beginPath();
      g.moveTo((W * i) / 9, H * 0.12);
      g.lineTo((W * i) / 9 - 40, H * 0.88);
      g.stroke();
    }
  }
  // LED projector modules
  const mod = (x0, x1) => {
    const y0 = H * 0.22;
    const y1 = H * 0.72;
    g.save();
    g.beginPath();
    g.moveTo(x0 + 24, H - y1);
    g.lineTo(x1, H - y1);
    g.lineTo(x1 - 24, H - y0);
    g.lineTo(x0, H - y0);
    g.closePath();
    const rg = g.createRadialGradient((x0 + x1) / 2, H - (y0 + y1) / 2, 4, (x0 + x1) / 2, H - (y0 + y1) / 2, (x1 - x0) * 0.55);
    if (glow) {
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.5, '#8a8a8a');
      rg.addColorStop(1, '#202020');
    } else {
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.4, '#f2f5f8');
      rg.addColorStop(0.8, '#a9b0b9');
      rg.addColorStop(1, '#3c4148');
    }
    g.fillStyle = rg;
    g.fill();
    g.restore();
  };
  mod(W * 0.1, W * 0.48);
  mod(W * 0.54, W * 0.9);
  // LED position light along the brow
  g.fillStyle = '#ffffff';
  g.fillRect(W * 0.03, H * 0.08, W * 0.94, H * 0.075);
  // dark lower trim
  if (!glow) {
    g.fillStyle = '#16181b';
    g.fillRect(0, H * 0.9, W, H * 0.1);
  }
  return finish(c);
}

// Material library and liveries for the ZX-6R model.
import * as THREE from 'three';

export const LIVERIES = {
  krt: {
    id: 'krt',
    name: 'KRT Edition',
    colors: 'Lime Green / Ebony / Metallic Graphite Gray',
    primary: { color: '#58b81c', metalness: 0.08, roughness: 0.28 },
    body: { color: '#0a0b0d', metalness: 0.2, roughness: 0.26 },
    accent: { color: '#4a4e53', metalness: 0.55, roughness: 0.35 },
    stripeA: '#63c124', // lime green
    stripeB: '#cfe03a', // yellow-green
    stripeC: '#c9ced3', // silver line
    stripeD: '#666c73', // graphite panel
    tankLogo: '#16181b',
    rim: '#62c02c',
    script: '#ffffff',
    screenTint: '#c3ccd2',
  },
  gray: {
    id: 'gray',
    name: 'Pearl Storm Gray',
    colors: 'Pearl Storm Gray / Metallic Spark Black',
    primary: { color: '#8b9096', metalness: 0.45, roughness: 0.3 },
    body: { color: '#121316', metalness: 0.45, roughness: 0.3 },
    accent: { color: '#5d6168', metalness: 0.55, roughness: 0.33 },
    stripeA: '#9aa0a6',
    stripeB: '#c8343a',
    stripeC: '#d4d8dc',
    stripeD: '#5d6168',
    tankLogo: '#c8343a',
    rim: '#c8343a',
    script: '#e9ecef',
    screenTint: '#b9c1c7',
  },
};

const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

// Faceted chrome reflector pattern for the headlight housings.
function facetTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = 8;
  const pts = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const edge = i === 0 || j === 0 || i === n || j === n;
    pts.push([(i + (edge ? 0 : (rnd() - 0.5) * 0.7)) * (256 / n), (j + (edge ? 0 : (rnd() - 0.5) * 0.7)) * (256 / n)]);
  }
  const P = (i, j) => pts[j * (n + 1) + i];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    for (const tri of [[P(i, j), P(i + 1, j), P(i + 1, j + 1)], [P(i, j), P(i + 1, j + 1), P(i, j + 1)]]) {
      const v = 120 + Math.floor(rnd() * 135);
      g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 6)})`;
      g.beginPath();
      g.moveTo(...tri[0]);
      g.lineTo(...tri[1]);
      g.lineTo(...tri[2]);
      g.closePath();
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createMaterials() {
  const M = {
    // ---- livery driven paint
    primary: phys({ color: '#5fb52a', roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
    body: phys({ color: '#0b0c0e', roughness: 0.3, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
    accent: phys({ color: '#4a4e53', roughness: 0.35, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide }),
    decalSide: phys({ color: '#ffffff', roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.09, side: THREE.DoubleSide }),
    decalTank: phys({ color: '#ffffff', roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
    decalTail: phys({ color: '#ffffff', roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
    decalSideL: phys({ color: '#ffffff', roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.09, side: THREE.DoubleSide }),
    decalFront: phys({ color: '#ffffff', roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
    tankLogo: std({ color: '#ffffff', roughness: 0.3, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    screenBand: phys({ color: '#101214', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
    rimStripe: std({ color: '#62c02c', roughness: 0.35, metalness: 0.1 }),

    // ---- plastics, rubber, trim
    plastic: std({ color: '#121315', roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide }),
    plasticGloss: phys({ color: '#0d0e10', roughness: 0.25, metalness: 0.1, clearcoat: 0.6, side: THREE.DoubleSide }),
    rubber: std({ color: '#141414', roughness: 0.9, metalness: 0 }),
    tire: std({ color: '#161616', roughness: 0.82, metalness: 0 }),
    seat: std({ color: '#151516', roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
    seatStitch: std({ color: '#2a2b2d', roughness: 0.8 }),

    // ---- metals
    wheel: phys({ color: '#0c0c0d', roughness: 0.28, metalness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
    chrome: std({ color: '#f2f4f6', roughness: 0.06, metalness: 1, side: THREE.DoubleSide }),
    steel: std({ color: '#c3c7cc', roughness: 0.3, metalness: 1 }),
    disc: std({ color: '#b4b8bd', roughness: 0.26, metalness: 1 }),
    alu: std({ color: '#a3a9b0', roughness: 0.38, metalness: 1 }),
    aluDark: std({ color: '#202226', roughness: 0.38, metalness: 0.75 }),
    frame: phys({ color: '#141518', roughness: 0.42, metalness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.25 }),
    forkOuter: std({ color: '#1b1c1f', roughness: 0.32, metalness: 0.7 }),
    forkInner: std({ color: '#e8eaec', roughness: 0.05, metalness: 1 }),
    engine: std({ color: '#7a7f86', roughness: 0.58, metalness: 0.55 }),
    engineDark: std({ color: '#2b2d31', roughness: 0.55, metalness: 0.45 }),
    engineBlack: std({ color: '#1a1b1e', roughness: 0.45, metalness: 0.35 }),
    caliper: std({ color: '#2b2d31', roughness: 0.42, metalness: 0.55 }),
    chain: std({ color: '#3d3e41', roughness: 0.4, metalness: 0.95 }),
    sprocket: std({ color: '#9ea3a9', roughness: 0.3, metalness: 1 }),
    exhaust: phys({ color: '#141517', roughness: 0.28, metalness: 0.65, clearcoat: 0.6 }),
    exhaustTip: std({ color: '#d7dade', roughness: 0.14, metalness: 1 }),
    brushed: phys({ color: '#c9cdd1', roughness: 0.3, metalness: 1, clearcoat: 0.3, clearcoatRoughness: 0.2 }),
    exhaustHot: std({ color: '#4a4540', roughness: 0.5, metalness: 0.85 }),
    radiator: std({ color: '#1a1b1d', roughness: 0.7, metalness: 0.3 }),
    bolt: std({ color: '#c9ccd0', roughness: 0.25, metalness: 1 }),
    gold: std({ color: '#c8a24a', roughness: 0.3, metalness: 1 }),

    // ---- glass and lights
    screen: phys({ color: '#c3ccd2', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    lens: phys({ color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    lensRed: phys({ color: '#b3121b', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    headlightInner: std({ color: '#d4d8de', roughness: 0.12, metalness: 1, map: facetTexture(), side: THREE.DoubleSide }),
    led: std({ color: '#ffffff', emissive: '#e9f3ff', emissiveIntensity: 2.4, roughness: 0.3 }),
    ledRed: std({ color: '#ff2a2a', emissive: '#ff1010', emissiveIntensity: 1.6, roughness: 0.4 }),
    amber: std({ color: '#ffae2a', emissive: '#ff8c00', emissiveIntensity: 0.25, roughness: 0.3 }),
    reflector: std({ color: '#c0121c', roughness: 0.35, metalness: 0.2 }),
    gauge: std({ color: '#ffffff', roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.25 }),
    mesh: std({ color: '#0a0a0b', roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }),
  };
  for (const k of ['body', 'accent', 'decalSide', 'decalSideL', 'plasticGloss']) M[k].envMapIntensity = 0.7;
  for (const [k, m] of Object.entries(M)) m.name = k;
  return M;
}

export function applyLivery(M, livery, textures) {
  const L = LIVERIES[livery] || LIVERIES.krt;
  const set = (mat, spec) => {
    mat.color.set(spec.color);
    mat.metalness = spec.metalness;
    mat.roughness = spec.roughness;
    mat.needsUpdate = true;
  };
  set(M.primary, L.primary);
  set(M.body, L.body);
  set(M.accent, L.accent);
  M.rimStripe.color.set(L.rim);
  M.screen.color.set(L.screenTint);
  if (textures) {
    for (const key of Object.keys(textures)) {
      if (!M[key]) continue;
      const t = textures[key](L);
      if (t) {
        if (M[key].map) M[key].map.dispose();
        M[key].map = t;
        M[key].metalness = L.body.metalness;
        M[key].roughness = L.body.roughness;
        M[key].needsUpdate = true;
      }
    }
  }
  return L;
}

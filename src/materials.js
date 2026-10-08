// Material library and liveries for the ZX-6R model.
import * as THREE from 'three';

export const LIVERIES = {
  krt: {
    id: 'krt',
    name: 'KRT Edition',
    colors: 'Lime Green / Ebony / Metallic Graphite Gray',
    primary: { color: '#6cbb3c', metalness: 0.08, roughness: 0.28 },
    body: { color: '#19191b', metalness: 0.2, roughness: 0.26 },
    accent: { color: '#4a4e53', metalness: 0.55, roughness: 0.35 },
    stripeA: '#63c124', // lime green
    stripeB: '#cfe03a', // yellow-green
    stripeC: '#c9ced3', // silver line
    stripeD: '#77797d', // graphite panel
    lower: '#33363a', // lower fairing (dark graphite)
    tankLogo: '#16181b',
    rim: '#62c02c',
    script: '#ffffff',
    screenTint: '#7d878e',
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
      const v = 165 + Math.floor(rnd() * 90);
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

// Black dealer plate with the wordmark (as on the press-photo bike).
function plateTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 330;
  const g = c.getContext('2d');
  g.fillStyle = '#0d0e10';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#d9dcdf';
  g.lineWidth = 8;
  g.strokeRect(18, 18, c.width - 36, c.height - 36);
  g.fillStyle = '#f2f3f4';
  g.font = 'italic 900 92px "Kanit", "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('Kawasaki', c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c);
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
    // lower fairing: same artwork, satin finish so the belly does not mirror
    // the bright floor (it reads dark in the studio photos)
    decalLower: phys({ color: '#ffffff', roughness: 0.5, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.3, side: THREE.DoubleSide }),
    decalLowerL: phys({ color: '#ffffff', roughness: 0.5, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.3, side: THREE.DoubleSide }),
    decalFront: phys({ color: '#ffffff', roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
    tankLogo: std({ color: '#ffffff', roughness: 0.3, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    screenBand: phys({ color: '#101214', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
    rimStripe: std({ color: '#62c02c', roughness: 0.35, metalness: 0.1 }),
    plate: std({ color: '#ffffff', map: plateTexture(), roughness: 0.45, metalness: 0.1 }),

    // ---- plastics, rubber, trim
    plastic: std({ color: '#121315', roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide }),
    plasticGloss: phys({ color: '#0d0e10', roughness: 0.25, metalness: 0.1, clearcoat: 0.6, side: THREE.DoubleSide }),
    rubber: std({ color: '#141414', roughness: 0.9, metalness: 0 }),
    // back wall of the fairing vents: reads as a shadowed cavity
    ventDark: std({ color: '#060607', roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    tire: std({ color: '#161616', roughness: 0.82, metalness: 0 }),
    seat: std({ color: '#2e2f33', roughness: 0.68, metalness: 0, side: THREE.DoubleSide }),
    seatStitch: std({ color: '#2a2b2d', roughness: 0.8 }),

    // ---- metals
    wheel: phys({ color: '#0c0c0d', roughness: 0.28, metalness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
    chrome: std({ color: '#f2f4f6', roughness: 0.06, metalness: 1, side: THREE.DoubleSide }),
    steel: std({ color: '#c3c7cc', roughness: 0.3, metalness: 1 }),
    disc: std({ color: '#74787c', roughness: 0.42, metalness: 1 }),
    alu: std({ color: '#a3a9b0', roughness: 0.38, metalness: 1 }),
    aluDark: std({ color: '#202226', roughness: 0.38, metalness: 0.75 }),
    frame: phys({ color: '#1d1f23', roughness: 0.45, metalness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    forkOuter: std({ color: '#1b1c1f', roughness: 0.32, metalness: 0.7 }),
    forkInner: std({ color: '#e8eaec', roughness: 0.05, metalness: 1 }),
    engine: std({ color: '#5b5f65', roughness: 0.5, metalness: 0.6 }),
    // cast side covers (alternator, clutch): warm satin metallic gray, as in the photos
    engineCover: std({ color: '#8d8f91', roughness: 0.38, metalness: 0.8 }),
    engineDark: std({ color: '#383b40', roughness: 0.5, metalness: 0.5 }),
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
    screen: phys({ color: '#c3ccd2', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    lens: phys({ color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    lensRed: phys({ color: '#b3121b', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    // faceted chrome reflector: semi-gloss so it reads bright silver in the
    // studio light from any angle, as in the photos
    headlightInner: std({ color: '#eef1f4', roughness: 0.26, metalness: 0.72, map: facetTexture(), side: THREE.DoubleSide }),
    led: std({ color: '#ffffff', emissive: '#e9f3ff', emissiveIntensity: 2.4, roughness: 0.3 }),
    ledRed: std({ color: '#ff2a2a', emissive: '#ff1010', emissiveIntensity: 1.6, roughness: 0.4 }),
    amber: std({ color: '#ffae2a', emissive: '#ff8c00', emissiveIntensity: 0.25, roughness: 0.3 }),
    reflector: std({ color: '#c0121c', roughness: 0.35, metalness: 0.2 }),
    gauge: std({ color: '#ffffff', roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.25 }),
    mesh: std({ color: '#0a0a0b', roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }),
  };
  // NB: with scene.environment (no per-material envMap) three.js r170 uses
  // scene.environmentIntensity for every material and ignores
  // material.envMapIntensity, so reflections are tuned by clearcoat roughness
  // and by the environment rotation in the viewer instead.
  for (const k of ['body', 'accent', 'decalSide', 'decalSideL', 'plasticGloss']) M[k].clearcoatRoughness = 0.1;
  for (const k of ['primary', 'decalFront']) M[k].clearcoatRoughness = 0.08;
  M.wheel.clearcoatRoughness = 0.16;
  for (const k of ['primary', 'body', 'accent', 'decalSide', 'decalSideL', 'decalLower', 'decalLowerL', 'decalFront', 'decalTank', 'decalTail']) bareBackFaces(M[k]);
  for (const [k, m] of Object.entries(M)) m.name = k;
  return M;
}

// Painted panels are double sided; their inner faces (seen through gaps in
// the bodywork) show bare black plastic instead of the paint and artwork.
function bareBackFaces(m) {
  const back = typeof globalThis !== 'undefined' && globalThis.__backDebug ? 'vec3( 1.0, 0.0, 1.0 )' : 'vec3( 0.012 )';
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>\n\tif ( ! gl_FrontFacing ) diffuseColor.rgb = ${back};`)
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n\tif ( ! gl_FrontFacing ) {\n\t\tmaterial.roughness = 0.75;\n\t\t#ifdef USE_CLEARCOAT\n\t\tmaterial.clearcoat = 0.0;\n\t\t#endif\n\t}'
      );
  };
  m.customProgramCacheKey = () => 'bareBack' + back;
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
        // the nose texture is mostly the primary colour; keep its finish
        const spec = key === 'decalFront' ? L.primary : L.body;
        M[key].metalness = spec.metalness;
        M[key].roughness = spec.roughness;
        M[key].needsUpdate = true;
      }
    }
  }
  // the lower fairing shares the side artwork
  if (M.decalLower && M.decalSide.map) {
    M.decalLower.map = M.decalSide.map;
    M.decalLowerL.map = M.decalSideL.map;
    M.decalLower.needsUpdate = M.decalLowerL.needsUpdate = true;
  }
  return L;
}

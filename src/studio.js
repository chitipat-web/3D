// Studio lighting: a photographed studio HDRI (with a procedural soft-box
// fallback) for reflections, plus key/fill lights and a shadow-catching floor.
// Shared by the viewer and the headless render tool.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// "Studio Small 08" by Sergej Majboroda, Poly Haven (CC0)
export const STUDIO_HDR = 'assets/studio_small_08_1k.hdr';

// Load the HDRI and turn it into a prefiltered environment map. `source` is a
// URL, or an ArrayBuffer with the .hdr file contents. Resolves null on failure.
// `overhead` adds a broad diffuser over the bike (radiance relative to the
// white cyclorama, ~0.7): the HDRI's dark ceiling leaves up-facing gloss
// black, while the official photos show a bright overhead light in it.
export async function loadStudioHDR(renderer, source = STUDIO_HDR, { overhead = 0 } = {}) {
  try {
    const loader = new RGBELoader();
    let tex;
    if (source instanceof ArrayBuffer) {
      const data = loader.parse(source);
      tex = new THREE.DataTexture(data.data, data.width, data.height, THREE.RGBAFormat, data.type);
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.flipY = true;
      tex.needsUpdate = true;
    } else {
      tex = await loader.loadAsync(source);
    }
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer);
    let env;
    if (overhead > 0) {
      const s = new THREE.Scene();
      s.background = tex;
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(overhead, overhead, overhead), side: THREE.DoubleSide })
      );
      card.position.set(0, 4, 0);
      card.rotation.x = Math.PI / 2;
      s.add(card);
      env = pm.fromScene(s, 0, 0.1, 100).texture;
    } else {
      env = pm.fromEquirectangular(tex).texture;
    }
    pm.dispose();
    tex.dispose();
    return env;
  } catch (e) {
    console.warn('studio HDRI unavailable, using the procedural studio', e);
    return null;
  }
}

function gradientSphere(top, horizon, bottom) {
  const geo = new THREE.SphereGeometry(30, 48, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      bottom: { value: new THREE.Color(bottom) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.6)) : mix(horizon, bottom, pow(-h, 0.4));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(geo, mat);
}

function softbox(w, h, intensity, color = '#ffffff') {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

export function createEnvironment(renderer, { dark = false } = {}) {
  const env = new THREE.Scene();
  env.add(dark ? gradientSphere('#3a3f46', '#1c1f24', '#0b0c0e') : gradientSphere('#c9d0d8', '#8e959e', '#3b3f45'));
  // overhead strip box, two side boxes and a low rim card
  const top = softbox(8, 2.2, dark ? 5 : 4.2);
  top.position.set(0, 9, 0);
  top.rotation.x = Math.PI / 2;
  env.add(top);
  const left = softbox(6, 3.5, dark ? 2.6 : 2.2);
  left.position.set(-2, 3.5, 8);
  left.lookAt(0, 0.6, 0);
  env.add(left);
  const right = softbox(6, 3.5, dark ? 2.2 : 1.8);
  right.position.set(3, 3.2, -8);
  right.lookAt(0, 0.6, 0);
  env.add(right);
  const front = softbox(3, 4, dark ? 1.8 : 1.5, '#f4f7ff');
  front.position.set(9, 3, 1);
  front.lookAt(0, 0.6, 0);
  env.add(front);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.035).texture;
  pm.dispose();
  return tex;
}

export function addStudioLights(scene, { dark = false, shadowSize = 2048 } = {}) {
  const key = new THREE.DirectionalLight(0xffffff, dark ? 2.0 : 2.4);
  key.position.set(2.2, 5.5, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(key.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 1, far: 14 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe7ff, dark ? 0.5 : 0.7);
  fill.position.set(-3, 2.2, -2.5);
  scene.add(fill);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, dark ? 0.25 : 0.35);
  scene.add(hemi);
  return { key, fill, hemi };
}

export function createFloor(color) {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'Floor';
  return floor;
}

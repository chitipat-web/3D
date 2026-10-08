// Interactive viewer for the procedural 2019 Kawasaki Ninja ZX-6R model.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildZX6R, setLivery } from './zx6r.js';
import { createEnvironment, addStudioLights, createFloor, loadStudioHDR, STUDIO_HDR } from './studio.js';
import { SPEC, FA, RA, PF, forkAt } from './layout.js';
import { EngineSound, IDLE_RPM } from './engine-sound.js';
import { LIVERY_FONTS } from './livery.js';
import { loadLiveryFonts } from './fonts.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 760px), (pointer: coarse)').matches;

// ---------------------------------------------------------------- renderer
const stageEl = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.75 : 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stageEl.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
stageEl.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.9;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 0.55, 0);
controls.autoRotateSpeed = 0.55;

const lights = addStudioLights(scene, { shadowSize: small ? 1024 : 2048 });
const floor = createFloor('#cccccc');
scene.add(floor);

// ---------------------------------------------------------------- model
const bike = buildZX6R({ livery: 'krt' });
bike.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = !o.material.transparent;
    o.receiveShadow = true;
  }
});
scene.add(bike);
const M = bike.userData.materials;
let currentLivery = 'krt';

// re-draw the livery once its lettering fonts (bundled copies) have loaded
loadLiveryFonts()
  .catch(() => false)
  .then(() => (document.fonts && document.fonts.load ? Promise.all(LIVERY_FONTS.map((f) => document.fonts.load(f).catch(() => null))) : null))
  .then(() => setLivery(bike, currentLivery))
  .catch(() => {});

// headlight beam on the floor + light state
const beam = new THREE.SpotLight(0xf2f6ff, 0, 7, 0.45, 0.7, 1.1);
beam.position.set(0.9, 0.78, 0);
beam.target.position.set(3.4, 0, 0);
scene.add(beam, beam.target);
let lightsOn = true;
function setLights(on) {
  lightsOn = on;
  M.led.emissiveIntensity = on ? 7 : 0;
  M.ledRed.emissiveIntensity = on ? 5 : 0.12;
  beam.intensity = on ? 10 : 0;
  $('#toggle-lights').setAttribute('aria-pressed', String(on));
}

// ---------------------------------------------------------------- post-processing
// quality 2: ambient occlusion + bloom, 1: bloom only, 0: plain render
let quality = small ? 1 : 2;

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
const renderPass = new RenderPass(scene, camera);
const gtao = new GTAOPass(scene, camera, 1, 1);
gtao.output = GTAOPass.OUTPUT.Default;
gtao.blendIntensity = 0.8;
gtao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.4, thickness: 1.0, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 12 });
// keep glass out of the AO normal/depth pass
gtao.overrideVisibility = function () {
  const cache = this._visibilityCache;
  this.scene.traverse((o) => {
    cache.set(o, o.visible);
    if (o.isPoints || o.isLine || (o.material && !Array.isArray(o.material) && o.material.transparent)) o.visible = false;
  });
};
// threshold sits above the lit floor/paint (HDR), so only LEDs and hot specular highlights glow
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.3, 4.5);
composer.addPass(renderPass);
composer.addPass(gtao);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function applyQuality() {
  gtao.enabled = quality >= 2;
  bloom.enabled = quality >= 1;
}
applyQuality();

// ---------------------------------------------------------------- theme + studio
// Reflections come from a photographed studio (HDRI); until it has loaded,
// or if it cannot load, a procedural soft-box studio stands in.
let hdrEnv = null;
let proceduralEnv = null;
function applyTheme() {
  const dark = isDark();
  const bg = new THREE.Color(css('--stage') || (dark ? '#15181c' : '#dcdfe3'));
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 7, 16);
  floor.material.color.set(css('--floor') || (dark ? '#1b1f24' : '#cfd3d8'));
  if (hdrEnv) {
    scene.environment = hdrEnv;
    // 135 deg puts the HDRI's soft boxes overhead and behind for the default
    // views, so black panels show soft gradients instead of a white glare
    scene.environmentRotation.set(0, (3 * Math.PI) / 4, 0);
    scene.environmentIntensity = dark ? 0.8 : 1.0;
    lights.key.intensity = dark ? 1.5 : 1.7;
    lights.fill.intensity = 0.25;
    lights.hemi.intensity = 0;
  } else {
    if (proceduralEnv) proceduralEnv.dispose();
    proceduralEnv = createEnvironment(renderer, { dark });
    scene.environment = proceduralEnv;
    scene.environmentIntensity = 1;
    lights.key.intensity = dark ? 2.0 : 2.4;
    lights.fill.intensity = dark ? 0.5 : 0.7;
    lights.hemi.intensity = dark ? 0.2 : 0.35;
  }
}
applyTheme();
(async () => {
  // the offline single-file build embeds the HDRI as base64; the published
  // page ships it as a base64 text file, since its host does not serve .hdr
  let source = STUDIO_HDR;
  let b64 = window.__ZX6R_HDR;
  if (!b64 && window.__ZX6R_HDR_TXT) {
    b64 = await fetch(window.__ZX6R_HDR_TXT).then((r) => (r.ok ? r.text() : null)).catch(() => null);
  }
  if (b64) {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    source = buf.buffer;
  }
  hdrEnv = await loadStudioHDR(renderer, source);
  if (hdrEnv) applyTheme();
})();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------------------------------------------------------------- exploded view
// offset at full explode for each part group: [x, y, z]; z moves the right and
// left halves of a group apart.
const EXPLODE = {
  Nose: [0.34, 0.12, 0],
  Windscreen: [0.22, 0.36, 0],
  Instruments: [0.04, 0.3, 0],
  Mirrors: [0.14, 0.3, 0.06],
  UpperSideCowl: [0.08, 0.06, 0.34],
  MidSideCowl: [0.06, -0.02, 0.44],
  RadiatorVents: [0.04, -0.02, 0.3],
  SideCover: [0, 0.08, 0.36],
  SeatSideCover: [-0.04, 0.12, 0.3],
  FairingLiner: [0.06, 0.02, 0.24],
  LowerFairing: [0.04, -0.08, 0.42],
  InnerCover: [0.04, 0.08, 0.14],
  FrontSignals: [0.08, -0.02, 0.48],
  BellyPan: [0, -0.18, 0],
  Tank: [0.02, 0.38, 0],
  Seats: [-0.06, 0.3, 0],
  TailCowl: [-0.14, 0.26, 0.12],
  TailEnd: [-0.32, 0.12, 0],
  FrontFender: [0.24, 0.02, 0],
  FrontWheel: [0.36, 0, 0],
  FrontCalipers: [0.36, 0, 0.12],
  FrontFork: [0.16, 0.06, 0],
  Controls: [0.1, 0.2, 0],
  RearWheel: [-0.4, 0, 0],
  RearCaliper: [-0.4, 0, 0.12],
  Drive: [-0.18, 0, -0.12],
  Swingarm: [-0.2, -0.04, 0],
  RearShock: [-0.04, 0.14, 0],
  FootControls: [-0.02, -0.04, 0.2],
  Engine: [0.0, -0.08, 0],
  Exhaust: [0, -0.16, 0.3],
  Frame: [0, 0.08, 0],
};
const exploders = [];
{
  const box = new THREE.Box3();
  const c = new THREE.Vector3();
  bike.updateMatrixWorld(true);
  bike.traverse((o) => {
    const off = EXPLODE[o.name];
    if (!off) return;
    const entry = { obj: o, base: o.position.clone(), off: new THREE.Vector3(off[0], off[1], 0), kids: [] };
    if (off[2]) {
      for (const k of o.children) {
        box.setFromObject(k);
        if (box.isEmpty()) continue;
        box.getCenter(c);
        const side = Math.abs(c.z) > 0.03 ? Math.sign(c.z) : 0;
        if (side) entry.kids.push({ obj: k, base: k.position.clone(), dz: side * off[2] });
      }
    }
    exploders.push(entry);
  });
}
let explodeK = 0;
let explodeTarget = 0;
function applyExplode(k) {
  // stagger: bodywork leaves first, mechanicals follow
  for (const e of exploders) {
    const kk = THREE.MathUtils.smootherstep(k, 0, 1);
    e.obj.position.copy(e.base).addScaledVector(e.off, kk);
    for (const kid of e.kids) kid.obj.position.set(kid.base.x, kid.base.y, kid.base.z + kid.dz * kk);
  }
}
// silhouette samples (world-space vertices) used to frame the bike tightly
function sampleSilhouette(max = 2500) {
  bike.updateMatrixWorld(true);
  const pts = [];
  const v = new THREE.Vector3();
  let total = 0;
  bike.traverse((o) => {
    if (o.isMesh && o.visible) total += o.geometry.attributes.position.count;
  });
  const stride = Math.max(1, Math.floor(total / max));
  bike.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += stride) pts.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
  });
  return pts;
}
const silAssembled = sampleSilhouette();
applyExplode(1);
const silExploded = sampleSilhouette();
applyExplode(0);
bike.updateMatrixWorld(true);
let sil = silAssembled;

// ---------------------------------------------------------------- dimensions overlay
const dims = new THREE.Group();
dims.visible = false;
scene.add(dims);
function dimLine(a, b, text, offset) {
  const mat = new THREE.LineBasicMaterial({ color: 0x4f9e17, depthTest: false, transparent: true });
  const tick = (p, d) => [p.clone().add(d), p.clone().sub(d)];
  const dir = b.clone().sub(a).normalize();
  const n = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(0.025);
  const g = new THREE.BufferGeometry().setFromPoints([a, b, ...tick(a, n), ...tick(b, n)]);
  const line = new THREE.LineSegments(g, mat);
  line.renderOrder = 10;
  dims.add(line);
  const el = document.createElement('div');
  el.className = 'dim';
  el.textContent = text;
  const lab = new CSS2DObject(el);
  lab.position.copy(a.clone().add(b).multiplyScalar(0.5).add(offset || new THREE.Vector3()));
  lab.visible = false;
  dims.add(lab);
}
const fmt = (m) => `${Math.round(m * 1000).toLocaleString('en-US')} mm`;
{
  const z = 0.42;
  dimLine(new THREE.Vector3(RA.x, 0.03, z), new THREE.Vector3(FA.x, 0.03, z), `ฐานล้อ ${fmt(SPEC.wheelbase)}`, new THREE.Vector3(0, 0.05, 0));
  dimLine(new THREE.Vector3(-1.015, 0, -z), new THREE.Vector3(1.01, 0, -z), `ยาว ${fmt(SPEC.length)}`, new THREE.Vector3(0, -0.06, 0));
  dimLine(new THREE.Vector3(1.12, 0, 0), new THREE.Vector3(1.12, SPEC.height, 0), `สูง ${fmt(SPEC.height)}`, new THREE.Vector3(0.05, 0, 0));
  dimLine(new THREE.Vector3(-0.3, 0, 0.3), new THREE.Vector3(-0.3, SPEC.seatHeight, 0.3), `เบาะ ${fmt(SPEC.seatHeight)}`, new THREE.Vector3(0.06, -0.15, 0));
}
function setDims(on) {
  dims.visible = on;
  for (const o of dims.children) if (o.isCSS2DObject) o.visible = on;
  $('#toggle-dims').setAttribute('aria-pressed', String(on));
}

// ---------------------------------------------------------------- hotspots
const fork = forkAt(0.3).addScaledVector(PF, 0.03);
const HOTSPOTS = [
  { g: 'Nose', p: [0.85, 0.79, 0.15], n: [1, 0.1, 0.6], t: 'ไฟหน้า LED คู่', d: 'ไฟหน้า LED ทั้งหมดพร้อมไฟหรี่ LED เป็นของใหม่ในปี 2019 ลำแสงไกลและสว่างกว่าหลอดฮาโลเจนรุ่นก่อน' },
  { g: 'Nose', p: [0.82, 0.86, 0], n: [1, 0.35, 0], t: 'ช่องรับอากาศ Ram Air', d: 'อัดอากาศเข้าหม้อกรองตามความเร็ว กำลังสูงสุดเพิ่มจาก 130 PS เป็น 136 PS เมื่อวิ่งเร็ว' },
  { g: 'Instruments', p: [0.56, 0.99, 0], n: [-0.6, 1, 0], t: 'หน้าปัด', d: 'เข็มวัดรอบแบบอนาล็อก คู่กับจอ LCD แสดงเกียร์ ความเร็ว น้ำมัน และโหมดแทร็กชันคอนโทรล KTRC' },
  { g: 'FrontFork', p: [fork.x, fork.y, 0.12], n: [0.5, 0, 1], t: 'โช้คหน้า Showa SFF-BP', d: 'โช้คหัวกลับ 41 มม. แบบ Separate Function Fork – Big Piston แยกหน้าที่สปริงกับหน่วงคนละข้าง ระยะยุบ 120 มม.' },
  { g: 'FrontCalipers', p: [FA.x - 0.12, FA.y + 0.05, 0.12], n: [0, 0, 1], t: 'เบรกหน้า Nissin', d: 'คาลิปเปอร์โมโนบล็อก 4 พอต ยึดแบบเรเดียล กับจานเบรกทรงกลีบดอกคู่ 310 มม. และระบบ ABS (KIBS)' },
  { g: 'Engine', p: [0.14, 0.42, 0.21], n: [0, 0, 1], t: 'เครื่องยนต์ 636 cc', d: '4 สูบเรียง DOHC 16 วาล์ว ระบายความร้อนด้วยน้ำ 130 PS ที่ 13,500 rpm แรงบิด 70.8 N·m ที่ 11,000 rpm' },
  { g: 'FootControls', p: [-0.16, 0.42, -0.19], n: [0, 0, -1], t: 'ควิกชิฟเตอร์ KQS', d: 'ปี 2019 เพิ่มควิกชิฟเตอร์ เปลี่ยนเกียร์ขึ้นได้โดยไม่ต้องบีบคลัตช์และไม่ต้องผ่อนคันเร่ง' },
  { g: 'Tank', p: [0.1, 0.99, 0.1], n: [0, 1, 0.4], t: 'ถังน้ำมัน 17 ลิตร', d: 'ถังทรงเว้าช่วงเข่า ช่วยให้ล็อกตัวกับรถได้มั่นคงตอนเบรกและเข้าโค้ง' },
  { g: 'Seats', p: [-0.27, 0.85, 0.1], n: [0, 1, 0.5], t: 'เบาะสูง 830 มม.', d: 'ปี 2019 เบาะคนขับแคบลงช่วงด้านหน้าให้วางเท้าถึงพื้นง่ายขึ้น และปรับทรงด้านหลังให้รองรับดีขึ้น' },
  { g: 'Swingarm', p: [-0.46, 0.4, 0.15], n: [0, 0, 1], t: 'ช่วงล่างหลัง Uni-Trak', d: 'โช้คเดี่ยวแบบ Bottom-link Uni-Trak ปรับความหนืดได้ ระยะยุบ 150 มม. กับสวิงอาร์มอะลูมิเนียม' },
  { g: 'Exhaust', p: [-0.72, 0.51, 0.26], n: [0, 0.3, 1], t: 'ท่อไอเสีย', d: 'ท่อ 4 เส้นรวมเข้าห้องพักไอเสียใต้เครื่อง แล้วออกปลายท่อสแตนเลสด้านขวา ปี 2019 เปลี่ยนฝาท้ายปลายท่อใหม่' },
  { g: 'TailEnd', p: [-0.84, 0.98, 0], n: [-1, 0.25, 0], t: 'ไฟท้าย LED', d: 'ท้ายทรงเหลี่ยมคมแบบเดียวกับ ZX-10R ไฟท้าย LED ใต้ปลายท้าย และขายึดป้ายทะเบียนแบบสั้น' },
  { g: 'RearWheel', p: [RA.x - 0.05, RA.y + 0.24, 0.1], n: [0, 0.3, 1], t: 'ล้อ 17 นิ้ว', d: 'ล้อแม็ก 6 ก้าน ยางหน้า 120/70 ZR17 ยางหลัง 180/55 ZR17' },
];
const hotspotRoot = new THREE.Group();
scene.add(hotspotRoot);
const hotspots = [];
const card = $('#hotspot-card');
let activeHot = -1;
HOTSPOTS.forEach((h, i) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'hot';
  el.textContent = String(i + 1);
  el.setAttribute('aria-label', h.t);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    openHot(i);
  });
  const obj = new CSS2DObject(el);
  obj.position.set(...h.p);
  obj.visible = false;
  hotspotRoot.add(obj);
  const group = bike.getObjectByName(h.g);
  hotspots.push({ ...h, obj, el, base: new THREE.Vector3(...h.p), n: new THREE.Vector3(...h.n).normalize(), group, groupBase: group ? group.position.clone() : null });
});
let hotOn = false;
function setHotspots(on) {
  hotOn = on;
  for (const h of hotspots) h.obj.visible = on;
  if (!on) closeHot();
  $('#toggle-hot').setAttribute('aria-pressed', String(on));
}
function openHot(i) {
  activeHot = i;
  const h = hotspots[i];
  $('#hot-num').textContent = String(i + 1);
  $('#hot-title').textContent = h.t;
  $('#hot-body').textContent = h.d;
  card.hidden = false;
  hotspots.forEach((x, j) => x.el.classList.toggle('on', j === i));
}
function closeHot() {
  activeHot = -1;
  card.hidden = true;
  hotspots.forEach((x) => x.el.classList.remove('on'));
}
$('#hot-close').addEventListener('click', closeHot);
$('#hot-prev').addEventListener('click', () => openHot((activeHot - 1 + hotspots.length) % hotspots.length));
$('#hot-next').addEventListener('click', () => openHot((activeHot + 1) % hotspots.length));
const tmpV = new THREE.Vector3();
function updateHotspots() {
  if (!hotOn) return;
  for (const h of hotspots) {
    h.obj.position.copy(h.base);
    if (h.group) h.obj.position.add(h.group.position).sub(h.groupBase);
    tmpV.copy(camera.position).sub(h.obj.position).normalize();
    const facing = tmpV.dot(h.n);
    h.el.style.opacity = facing > 0.05 ? '1' : facing > -0.25 ? String(0.25 + (facing + 0.25) * 2.5) : '0';
    h.el.style.pointerEvents = facing > -0.1 ? 'auto' : 'none';
  }
}

// ---------------------------------------------------------------- views
// Each preset is a viewing direction; the distance is fitted to the free
// area between the HUD panels so the whole bike is always in frame.
const VIEWS = {
  front34: { d: [0.72, 0.3, 0.63], t: [0.02, 0.55, 0] },
  side: { d: [0, 0.06, 1], t: [0, 0.55, 0] },
  rear34: { d: [-0.74, 0.34, 0.58], t: [-0.05, 0.55, 0] },
  front: { d: [1, 0.08, 0.0005], t: [0, 0.58, 0] },
  top: { d: [0.0005, 1, 0.004], t: [0, 0.45, 0] },
  cockpit: { d: [-0.85, 0.75, 0.0005], t: [0.45, 0.92, 0], fixed: 1.15 },
};
const free = { top: 0, bottom: 0 };
function measureFree() {
  const H = stageEl.clientHeight;
  const W = stageEl.clientWidth;
  const dock = $('.dock').getBoundingClientRect();
  const title = $('.title').getBoundingClientRect();
  const wide = W > 760;
  free.top = wide ? Math.min(title.bottom, H * 0.16) : title.bottom + 6;
  free.bottom = Math.max(free.top + H * 0.3, dock.top - 8);
}
function applyViewOffset() {
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight;
  const centre = (free.top + free.bottom) / 2;
  camera.setViewOffset(W, H, 0, H / 2 - centre, W, H);
  camera.updateProjectionMatrix();
}
function fitDistance(dir, target) {
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight;
  const fy = Math.max(0.25, (free.bottom - free.top) / H);
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const th = tv * (W / H);
  const tmp = new THREE.PerspectiveCamera();
  tmp.position.copy(target).add(dir);
  tmp.lookAt(target);
  tmp.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(tmp.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(tmp.matrixWorld, 1);
  let D = 0;
  const c = new THREE.Vector3();
  for (const q of sil) {
    c.copy(q).sub(target);
    const r = Math.abs(c.dot(right));
    const u = Math.abs(c.dot(up));
    const d = c.dot(dir);
    D = Math.max(D, d + r / (th * 0.9), d + u / (tv * fy * 0.9));
  }
  return D;
}
let tween = null;
let currentView = 'front34';
function goTo(name, instant = false) {
  const v = VIEWS[name];
  if (!v) return;
  currentView = name;
  const dir = new THREE.Vector3(...v.d).normalize();
  const t1 = new THREE.Vector3(...v.t);
  const p1 = t1.clone().addScaledVector(dir, v.fixed || fitDistance(dir, t1));
  $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  if (instant || reducedMotion) {
    tween = null;
    camera.position.copy(p1);
    controls.target.copy(t1);
    controls.update();
    return;
  }
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, start: performance.now(), dur: 900 };
}

// ---------------------------------------------------------------- engine
const engine = new EngineSound();
let ignition = false;
let audioOk = true;
const rpmEl = $('#rpm');
const startBtn = $('#engine-start');
const revBtn = $('#engine-rev');
async function toggleEngine() {
  if (!ignition) {
    ignition = true;
    startBtn.setAttribute('aria-pressed', 'true');
    startBtn.querySelector('span').textContent = 'ดับเครื่อง';
    revBtn.disabled = false;
    if (!lightsOn) setLights(true);
    try {
      await engine.start();
      audioOk = true;
    } catch {
      audioOk = false;
      say('เบราว์เซอร์นี้เล่นเสียงไม่ได้ แต่ยังดูเข็มวัดรอบได้');
    }
  } else {
    ignition = false;
    engine.stop();
    startBtn.setAttribute('aria-pressed', 'false');
    startBtn.querySelector('span').textContent = 'สตาร์ทเครื่อง';
    revBtn.disabled = true;
  }
}
startBtn.addEventListener('click', toggleEngine);
const throttleOn = (e) => {
  if (!ignition) return;
  e.preventDefault();
  engine.throttle = 1;
  revBtn.classList.add('held');
};
const throttleOff = () => {
  engine.throttle = 0;
  revBtn.classList.remove('held');
};
revBtn.addEventListener('pointerdown', throttleOn);
['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => revBtn.addEventListener(ev, throttleOff));
revBtn.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && ignition && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    engine.throttle = 1;
    revBtn.classList.add('held');
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') throttleOff();
});
// simulated rpm when audio is unavailable
let simRpm = 0;

// ---------------------------------------------------------------- UI wiring
function setPressed(sel, el) {
  $$(sel).forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
}
$$('[data-livery]').forEach((b) =>
  b.addEventListener('click', () => {
    currentLivery = b.dataset.livery;
    const L = setLivery(bike, currentLivery);
    setPressed('[data-livery]', b);
    $('#livery-name').textContent = L.colors;
  })
);
$$('[data-view]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.view)));
// dock tabs
const tabs = [...$$('[role="tab"]')];
function selectTab(tab) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
  requestAnimationFrame(() => {
    measureFree();
    applyViewOffset();
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus();
      selectTab(n);
    }
  });
});

const rotateBtn = $('#toggle-rotate');
function setRotate(on) {
  controls.autoRotate = on;
  rotateBtn.setAttribute('aria-pressed', String(on));
}
rotateBtn.addEventListener('click', () => setRotate(!controls.autoRotate));
$('#toggle-lights').addEventListener('click', () => setLights(!lightsOn));
$('#toggle-dims').addEventListener('click', () => setDims(!dims.visible));
$('#toggle-hot').addEventListener('click', () => setHotspots(!hotOn));
const explodeBtn = $('#toggle-explode');
explodeBtn.addEventListener('click', () => {
  explodeTarget = explodeTarget ? 0 : 1;
  explodeBtn.setAttribute('aria-pressed', String(!!explodeTarget));
  if (explodeTarget && dims.visible) setDims(false);
  sil = explodeTarget ? silExploded : silAssembled;
  if (currentView && !VIEWS[currentView].fixed) goTo(currentView);
});
renderer.domElement.addEventListener('pointerdown', () => {
  tween = null;
  if (controls.autoRotate) setRotate(false);
});
const specBtn = $('#spec-toggle');
if (specBtn) {
  specBtn.addEventListener('click', () => {
    const open = specBtn.getAttribute('aria-expanded') !== 'true';
    specBtn.setAttribute('aria-expanded', String(open));
    specBtn.setAttribute('aria-pressed', String(open));
    $('#spec').classList.toggle('open', open);
  });
}

// ---------------------------------------------------------------- downloads
const status = $('#status');
function say(msg) {
  status.textContent = msg;
  status.hidden = false;
  clearTimeout(say.t);
  say.t = setTimeout(() => (status.hidden = true), 3200);
}

// Minimal ZIP writer (stored, no compression) so the .glb can travel as .zip.
function crc32(buf) {
  let c;
  const table = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameB = enc.encode(name);
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, nameB.length, true);
    chunks.push(new Uint8Array(lh.buffer), nameB, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameB.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameB);
    offset += 30 + nameB.length + data.length;
  }
  const size = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

let downloads = null;
let canSave = true;
(async () => {
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      downloads = await window.claude.use('downloads');
    } catch {
      downloads = null;
    }
    if (!downloads) {
      canSave = false;
      $$('[data-save]').forEach((b) => (b.hidden = true));
      $('#files-hint').hidden = true;
      $('#files-note').hidden = false;
    }
  }
})();

async function offer(filename, blob) {
  if (downloads) {
    try {
      await downloads.save({ filename, data: blob });
      say('บันทึกไฟล์แล้ว');
    } catch (e) {
      if (e && e.code === 'declined') say('ยกเลิกการบันทึก');
      else if (e && e.code === 'rate_limited') say('มีหน้าต่างบันทึกเปิดอยู่ ลองอีกครั้งภายหลัง');
      else say('บันทึกไฟล์ไม่ได้ในหน้านี้');
    }
    return;
  }
  if (!canSave) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
  say('เริ่มดาวน์โหลดแล้ว');
}

function renderFrame() {
  if (quality > 0) composer.render();
  else renderer.render(scene, camera);
}
$('#save-png').addEventListener('click', () => {
  renderFrame();
  renderer.domElement.toBlob((blob) => blob && offer('kawasaki-zx6r-2019.png', blob), 'image/png');
});
// AR: iPhone/iPad (AR Quick Look, USDZ) and Android (Scene Viewer, GLB).
// Shown only where the model files are served next to the page.
(async () => {
  const link = $('#ar-link');
  if (!link || location.protocol === 'file:') return;
  const a = document.createElement('a');
  const quickLook = !!(a.relList && a.relList.supports && a.relList.supports('ar'));
  const android = /Android/i.test(navigator.userAgent);
  if (!quickLook && !android) return;
  const file = quickLook ? 'models/kawasaki-zx6r-2019.usdz' : 'models/kawasaki-zx6r-2019.glb';
  try {
    const res = await fetch(file, { method: 'HEAD' });
    if (!res.ok) return;
  } catch {
    return;
  }
  if (android) {
    const abs = new URL(file, location.href).href;
    const fallback = encodeURIComponent(location.href);
    link.removeAttribute('rel');
    link.href =
      'intent://arvr.google.com/scene-viewer/1.0?file=' + encodeURIComponent(abs) + '&mode=ar_preferred&title=' +
      encodeURIComponent('Kawasaki Ninja ZX-6R 2019') +
      '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=' +
      fallback + ';end;';
  }
  link.hidden = false;
})();

// self-contained copy of this page (three.js inlined) to open from disk
const offlineBtn = $('#save-offline');
if (location.protocol === 'file:') {
  offlineBtn.hidden = true;
  $('#hint-offline').hidden = true;
}
offlineBtn.addEventListener('click', async () => {
  say('กำลังเตรียมไฟล์ HTML…');
  try {
    const res = await fetch(offlineBtn.dataset.src);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    offer('kawasaki-zx6r-2019.html', new Blob([blob], { type: 'text/html' }));
  } catch {
    say('ดาวน์โหลดไฟล์ HTML ไม่ได้ ลองดาวน์โหลดจาก GitHub แทน');
  }
});
$('#save-glb').addEventListener('click', () => {
  say('กำลังเตรียมไฟล์ GLB…');
  const k = explodeK;
  applyExplode(0);
  bike.position.set(0, 0, 0);
  new GLTFExporter().parse(
    bike,
    (glb) => {
      applyExplode(k);
      offer('kawasaki-zx6r-2019-glb.zip', zipStore([{ name: 'kawasaki-zx6r-2019.glb', data: new Uint8Array(glb) }]));
    },
    () => {
      applyExplode(k);
      say('ส่งออก GLB ไม่สำเร็จ');
    },
    { binary: true, onlyVisible: true }
  );
});

// ---------------------------------------------------------------- loop
function resize() {
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  renderer.setSize(w, h, false);
  const pr = renderer.getPixelRatio();
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  gtao.setSize(Math.round(w * pr * 0.75), Math.round(h * pr * 0.75));
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 40 : w / h < 1.2 ? 34 : 30;
  measureFree();
  applyViewOffset();
  if (currentView) goTo(currentView, true);
}
new ResizeObserver(resize).observe(stageEl);
resize();
controls.addEventListener('start', () => (currentView = null));

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clock = new THREE.Clock();
let frames = 0;
let slowFrames = 0;
let lastQualityCheck = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now();
  if (tween) {
    const t = Math.min(1, (now - tween.start) / tween.dur);
    const k = ease(t);
    camera.position.lerpVectors(tween.p0, tween.p1, k);
    controls.target.lerpVectors(tween.t0, tween.t1, k);
    if (t >= 1) tween = null;
  }
  // exploded view animation
  if (explodeK !== explodeTarget) {
    const step = dt / (reducedMotion ? 0.01 : 1.1);
    explodeK = explodeTarget > explodeK ? Math.min(explodeTarget, explodeK + step) : Math.max(explodeTarget, explodeK - step);
    applyExplode(explodeK);
  }
  // engine: rpm, gauge, idle shake
  let rpm = 0;
  if (audioOk) rpm = engine.update(dt);
  else {
    const target = ignition ? IDLE_RPM + engine.throttle * 13800 : 0;
    simRpm += (target - simRpm) * Math.min(1, (target > simRpm ? 8 : 3) * dt);
    rpm = simRpm;
  }
  if (M.gauge) M.gauge.set({ rpm, on: ignition || rpm > 200 });
  if (rpmEl) rpmEl.textContent = ignition || rpm > 200 ? `${Math.round(rpm / 10) * 10} rpm` : 'ดับเครื่อง';
  if (rpm > 200 && !reducedMotion) {
    const a = 0.00045 + rpm * 0.00000004;
    bike.position.y = Math.sin(now * 0.12) * a;
    bike.position.z = Math.sin(now * 0.091) * a * 0.6;
  } else bike.position.set(0, 0, 0);

  controls.update();
  updateHotspots();
  renderFrame();
  labelRenderer.render(scene, camera);

  // adaptive quality: step down when frames are consistently slow
  frames++;
  if (frames > 40) {
    if (dt > 0.034) slowFrames++;
    if (now - lastQualityCheck > 2000) {
      if (slowFrames > 30 && quality > 0) {
        quality--;
        applyQuality();
      }
      slowFrames = 0;
      lastQualityCheck = now;
    }
  }
});
setLights(true);
setRotate(!reducedMotion);
document.documentElement.classList.add('ready');
window.__bike = bike;
window.__viewer = { composer, gtao, bloom, renderer, setQuality: (q) => ((quality = q), applyQuality()), goTo, setHotspots, openHot, explode: (k) => ((explodeTarget = k), (explodeK = k), applyExplode(k)), engine };

// Interactive viewer for the procedural 2019 Kawasaki Ninja ZX-6R model.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildZX6R, setLivery } from './zx6r.js';
import { createEnvironment, addStudioLights, createFloor } from './studio.js';
import { SPEC, FA, RA } from './layout.js';

const $ = (sel) => document.querySelector(sel);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
};

const stageEl = $('#stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
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
controls.minDistance = 1.2;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 0.55, 0);
controls.autoRotateSpeed = 0.55;

const lights = addStudioLights(scene, { shadowSize: matchMedia('(max-width: 700px)').matches ? 1024 : 2048 });
const floor = createFloor('#cccccc');
scene.add(floor);

// ---------------------------------------------------------------- model
const bike = buildZX6R({ livery: 'krt' });
bike.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});
scene.add(bike);
const M = bike.userData.materials;

// Head/tail light glow + a soft spot on the floor ahead of the bike
const beam = new THREE.SpotLight(0xf2f6ff, 0, 6, 0.42, 0.65, 1.2);
beam.position.set(0.95, 0.82, 0);
beam.target.position.set(3.2, 0, 0);
scene.add(beam, beam.target);
function setLights(on) {
  if (M.headlight) M.headlight.emissiveIntensity = on ? 1.6 : 0.05;
  M.ledRed.emissiveIntensity = on ? 1.6 : 0.1;
  beam.intensity = on ? 9 : 0;
}

// ---------------------------------------------------------------- theme
function applyTheme() {
  const dark = isDark();
  const bg = new THREE.Color(css('--stage') || (dark ? '#15181c' : '#dcdfe3'));
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 7, 16);
  floor.material.color.set(css('--floor') || (dark ? '#1b1f24' : '#cfd3d8'));
  if (scene.environment) scene.environment.dispose();
  scene.environment = createEnvironment(renderer, { dark });
  lights.key.intensity = dark ? 2.0 : 2.4;
  lights.hemi.intensity = dark ? 0.2 : 0.35;
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------------------------------------------------------------- dimensions overlay
const dims = new THREE.Group();
dims.visible = false;
scene.add(dims);
function dimLine(a, b, text, offset) {
  const mat = new THREE.LineBasicMaterial({ color: 0x4f9e17, depthTest: false, transparent: true });
  const pts = [a, b];
  const tick = (p, d) => [p.clone().add(d), p.clone().sub(d)];
  const dir = b.clone().sub(a).normalize();
  const n = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(0.025);
  const g = new THREE.BufferGeometry().setFromPoints([...pts, ...tick(a, n), ...tick(b, n)]);
  const line = new THREE.LineSegments(g, mat);
  line.renderOrder = 10;
  dims.add(line);
  const el = document.createElement('div');
  el.className = 'dim';
  el.textContent = text;
  const lab = new CSS2DObject(el);
  lab.position.copy(a.clone().add(b).multiplyScalar(0.5).add(offset || new THREE.Vector3()));
  dims.add(lab);
}
const fmt = (m) => `${Math.round(m * 1000).toLocaleString('en-US')} mm`;
{
  const z = 0.42;
  dimLine(new THREE.Vector3(RA.x, 0.03, z), new THREE.Vector3(FA.x, 0.03, z), `ฐานล้อ ${fmt(SPEC.wheelbase)}`, new THREE.Vector3(0, 0.05, 0));
  dimLine(new THREE.Vector3(-1.015, -0.0, -z), new THREE.Vector3(1.01, 0.0, -z), `ยาว ${fmt(SPEC.length)}`, new THREE.Vector3(0, -0.06, 0));
  dimLine(new THREE.Vector3(1.12, 0, 0), new THREE.Vector3(1.12, SPEC.height, 0), `สูง ${fmt(SPEC.height)}`, new THREE.Vector3(0.05, 0, 0));
  dimLine(new THREE.Vector3(-0.3, 0, 0.3), new THREE.Vector3(-0.3, SPEC.seatHeight, 0.3), `เบาะ ${fmt(SPEC.seatHeight)}`, new THREE.Vector3(0.06, -0.15, 0));
}
for (const o of dims.children) if (o.isCSS2DObject) o.visible = false;

// ---------------------------------------------------------------- views
// Each preset is a viewing direction; the distance is fitted to the free
// area between the HUD panels so the whole bike is always in frame.
const VIEWS = {
  front34: { d: [0.72, 0.3, 0.63], t: [0.02, 0.55, 0] },
  side: { d: [0, 0.06, 1], t: [0, 0.55, 0] },
  rear34: { d: [-0.74, 0.34, 0.58], t: [-0.05, 0.55, 0] },
  front: { d: [1, 0.08, 0.0005], t: [0, 0.58, 0] },
  top: { d: [0.0005, 1, 0.004], t: [0, 0.45, 0] },
};
const bbox = new THREE.Box3().setFromObject(bike);
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
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Vector3(i & 1 ? bbox.max.x : bbox.min.x, i & 2 ? bbox.max.y : bbox.min.y, i & 4 ? bbox.max.z : bbox.min.z).sub(target);
    const r = Math.abs(c.dot(right));
    const u = Math.abs(c.dot(up));
    const d = c.dot(dir);
    D = Math.max(D, d + r / (th * 0.94), d + u / (tv * fy * 0.94));
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
  const p1 = t1.clone().addScaledVector(dir, fitDistance(dir, t1));
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  if (instant) {
    camera.position.copy(p1);
    controls.target.copy(t1);
    controls.update();
    return;
  }
  tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, start: performance.now(), dur: 900 };
}

// ---------------------------------------------------------------- UI wiring
function setPressed(sel, el) {
  document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
}
document.querySelectorAll('[data-livery]').forEach((b) =>
  b.addEventListener('click', () => {
    const L = setLivery(bike, b.dataset.livery);
    setPressed('[data-livery]', b);
    $('#livery-name').textContent = L.colors;
  })
);
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.view)));

const rotateBtn = $('#toggle-rotate');
function setRotate(on) {
  controls.autoRotate = on;
  rotateBtn.setAttribute('aria-pressed', String(on));
}
rotateBtn.addEventListener('click', () => setRotate(!controls.autoRotate));
const lightBtn = $('#toggle-lights');
let lightsOn = true;
lightBtn.addEventListener('click', () => {
  lightsOn = !lightsOn;
  setLights(lightsOn);
  lightBtn.setAttribute('aria-pressed', String(lightsOn));
});
setLights(true);
const dimBtn = $('#toggle-dims');
dimBtn.addEventListener('click', () => {
  dims.visible = !dims.visible;
  for (const o of dims.children) if (o.isCSS2DObject) o.visible = dims.visible;
  dimBtn.setAttribute('aria-pressed', String(dims.visible));
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
      document.querySelectorAll('[data-save]').forEach((b) => (b.hidden = true));
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

$('#save-png').addEventListener('click', () => {
  renderer.render(scene, camera);
  renderer.domElement.toBlob((blob) => blob && offer('kawasaki-zx6r-2019.png', blob), 'image/png');
});
$('#save-glb').addEventListener('click', () => {
  say('กำลังเตรียมไฟล์ GLB…');
  const exporter = new GLTFExporter();
  exporter.parse(
    bike,
    (glb) => {
      const data = new Uint8Array(glb);
      offer('kawasaki-zx6r-2019-glb.zip', zipStore([{ name: 'kawasaki-zx6r-2019.glb', data }]));
    },
    () => say('ส่งออก GLB ไม่สำเร็จ'),
    { binary: true, onlyVisible: true }
  );
});

// ---------------------------------------------------------------- loop
let fitted = false;
function resize() {
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 40 : w / h < 1.2 ? 34 : 30;
  measureFree();
  applyViewOffset();
  if (!fitted || currentView) goTo(currentView || 'front34', true);
  fitted = true;
}
new ResizeObserver(resize).observe(stageEl);
resize();
controls.addEventListener('start', () => (currentView = null));

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
renderer.setAnimationLoop(() => {
  if (tween) {
    const t = Math.min(1, (performance.now() - tween.start) / tween.dur);
    const k = ease(t);
    camera.position.lerpVectors(tween.p0, tween.p1, k);
    controls.target.lerpVectors(tween.t0, tween.t1, k);
    if (t >= 1) tween = null;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
});
setRotate(!matchMedia('(prefers-reduced-motion: reduce)').matches);
document.documentElement.classList.add('ready');
window.__bike = bike;

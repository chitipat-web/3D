// Kawasaki Ninja ZX-6R (2019, ZX636G) — procedural three.js model.
import * as THREE from 'three';
import { createMaterials, applyLivery, LIVERIES } from './materials.js';
import { FA, RA } from './layout.js';
import { buildWheel, buildFrontBrakes, buildRearBrake, buildFrontEnd, buildControls } from './chassis.js';
import { buildFrame, buildSwingarm, buildChain, buildRearShock, buildFootControls } from './frame.js';
import { buildEngine, buildExhaust } from './engine.js';
import { buildBodywork } from './body.js';
import { sideTexture, tailTexture } from './decals.js';

const TEXTURES = {
  decalSide: (L) => sideTexture(L, false),
  decalSideL: (L) => sideTexture(L, true),
  decalTail: (L) => tailTexture(L, false),
  decalTailL: (L) => tailTexture(L, true),
};

export { LIVERIES };

export function buildZX6R({ livery = 'krt' } = {}) {
  const M = createMaterials();
  const root = new THREE.Group();
  root.name = 'Kawasaki_Ninja_ZX-6R_2019';

  const front = buildWheel(M, true);
  front.position.copy(FA);
  const rear = buildWheel(M, false);
  rear.position.copy(RA);
  root.add(front, rear);
  root.add(buildFrontBrakes(M));
  root.add(buildRearBrake(M));
  root.add(buildFrontEnd(M));
  root.add(buildControls(M));
  root.add(buildFrame(M));
  const sw = buildSwingarm(M);
  root.add(sw.grp);
  root.add(buildChain(M));
  root.add(buildRearShock(M));
  root.add(buildFootControls(M));
  root.add(buildEngine(M));
  root.add(buildExhaust(M));
  root.add(buildBodywork(M, livery));

  root.userData.materials = M;
  root.userData.textures = TEXTURES;
  root.userData.livery = applyLivery(M, livery, TEXTURES);
  return root;
}

export function setLivery(root, livery) {
  root.userData.livery = applyLivery(root.userData.materials, livery, root.userData.textures || null);
  return root.userData.livery;
}

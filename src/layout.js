// Key dimensions of the 2019 Kawasaki Ninja ZX-6R (ZX636G), in metres.
// Origin: ground plane, midway between the axles. +X forward, +Y up, +Z right.
import * as THREE from 'three';
import { DEG } from './geom.js';

export const SPEC = {
  length: 2.025,
  width: 0.71,
  height: 1.1,
  wheelbase: 1.4,
  seatHeight: 0.83,
  groundClearance: 0.13,
  rake: 24.5,
  trail: 0.103,
};

export const RAKE = SPEC.rake * DEG;
export const R_FRONT = 0.3; // 120/70 ZR17
export const R_REAR = 0.315; // 180/55 ZR17
export const FA = new THREE.Vector3(SPEC.wheelbase / 2, R_FRONT, 0); // front axle
export const RA = new THREE.Vector3(-SPEC.wheelbase / 2, R_REAR, 0); // rear axle

// Steering geometry
export const SD = new THREE.Vector3(-Math.sin(RAKE), Math.cos(RAKE), 0); // up the fork
export const PF = new THREE.Vector3(Math.cos(RAKE), Math.sin(RAKE), 0); // forward, normal to fork
export const OFFSET = (R_FRONT * Math.sin(RAKE) - SPEC.trail * Math.cos(RAKE)); // fork offset ~31 mm
export const forkAt = (s) => FA.clone().addScaledVector(SD, s);
export const steerAt = (s) => forkAt(s).addScaledVector(PF, -OFFSET);
export const FORK_Z = 0.103; // fork tube centre spacing (half)

// Fork stations (distance along the fork axis from the axle)
export const S_LOWER_CLAMP = 0.47;
export const S_UPPER_CLAMP = 0.6;
export const S_FORK_TOP = 0.635;

// Swing-arm pivot and engine reference
export const PIVOT = new THREE.Vector3(-0.137, 0.43, 0);
export const CRANK = new THREE.Vector3(0.115, 0.375, 0);
export const CYL_DIR = new THREE.Vector3(Math.sin(30 * DEG), Math.cos(30 * DEG), 0); // cylinder axis
export const CYL_FWD = new THREE.Vector3(Math.cos(30 * DEG), -Math.sin(30 * DEG), 0); // normal to bank, forward
export const SPROCKET_F = new THREE.Vector3(-0.068, 0.392, -0.098); // countershaft sprocket centre
export const CHAIN_Z = -0.098;

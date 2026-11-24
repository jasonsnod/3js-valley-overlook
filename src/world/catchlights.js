import * as THREE from 'three';
import { Glow } from './Glow.js';
import { SUN, bearingToWorldDir } from './location.js';

const CORNEA_RADIUS = 0.0078; // typical human cornea curvature radius, meters

/** Unit vector toward the real sun at the scene's place and moment (world space). */
export function sunDirection() {
  const d = bearingToWorldDir(SUN.azimuth, SUN.elevation);
  return new THREE.Vector3(d.x, d.y, d.z);
}

/**
 * Where the sun's reflection sits on each cornea, relative to the pupil
 * center, for a viewer straight in front of the eye. Derived from the real
 * sun so the catchlight and the scene lighting always agree. (The head faces
 * +Z unrotated, so head space and world space share directions.)
 */
export function catchlightOffset() {
  const view = new THREE.Vector3(0, 0, 1);
  const n = sunDirection().add(view).normalize(); // mirror normal between sun and viewer
  return new THREE.Vector3(n.x * CORNEA_RADIUS, n.y * CORNEA_RADIUS, 0.0004);
}

/** A glow on each cornea, driven together. */
export class Catchlights {
  constructor(scene, head) {
    this.eyes = {};
    const offset = catchlightOffset();
    for (const side of ['right', 'left']) {
      const pupil = head.localToWorld(head.userData.eyes[side].pupil.clone());
      const glow = new Glow(0.01);
      glow.position.copy(pupil).add(offset);
      scene.add(glow);
      this.eyes[side] = { pupil, glow };
    }
  }

  /** The person's right eye — the one the opening shot starts on. */
  get pupil() {
    return this.eyes.right.pupil;
  }

  set(level, size) {
    for (const { glow } of Object.values(this.eyes)) {
      glow.setLevel(level);
      glow.scale.setScalar(size);
    }
  }

  faceCamera(camera) {
    for (const { glow } of Object.values(this.eyes)) glow.faceCamera(camera);
  }
}

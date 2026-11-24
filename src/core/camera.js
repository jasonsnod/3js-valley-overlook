import * as THREE from 'three';

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    50, // fov
    window.innerWidth / window.innerHeight,
    0.005, // near — small, the opening shot is millimeters from the eye
    30000, // far — the landscape reaches ~15 km and the sky beyond
  );
  camera.position.set(0, 1.6, 1);
  return camera;
}

/**
 * Depth range scaled to what's in focus: the closer the subject, the closer
 * the near plane. Keeps depth precise both millimeters from an eye and
 * across 15 km of ridges.
 */
export function setClipping(camera, subjectDistance) {
  const near = THREE.MathUtils.clamp(subjectDistance * 0.3, 0.002, 0.5);
  if (Math.abs(camera.near - near) > near * 0.01 || camera.far !== 40000) {
    camera.near = near;
    camera.far = 40000;
    camera.updateProjectionMatrix();
  }
}

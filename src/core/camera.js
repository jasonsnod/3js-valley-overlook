import * as THREE from 'three';

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    50, // fov
    window.innerWidth / window.innerHeight,
    0.005, // near — small, the opening shot is millimeters from the eye
    2000, // far — generous, since a valley scene will have distant terrain
  );

  // Elevated vantage point looking out and slightly down, like an overlook.
  camera.position.set(0, 12, 40);
  camera.lookAt(0, 0, 0);

  return camera;
}
